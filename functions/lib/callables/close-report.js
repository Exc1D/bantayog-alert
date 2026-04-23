import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, isValidReportTransition, logDimension, } from '@bantayog/shared-validators';
import { adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { bantayogErrorToHttps } from './https-error.js';
import { enqueueSms } from '../services/send-sms.js';
export const closeReportRequestSchema = z.object({
    reportId: z.string().min(1).max(128),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    idempotencyKey: z.string().uuid(),
    closureSummary: z.string().trim().min(1).max(2000).optional(),
});
export async function closeReportCore(db, deps) {
    const correlationId = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `closeReport:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: idempotentPayload,
        now: () => deps.now.toMillis(),
    }, async () => {
        return db.runTransaction(async (tx) => {
            const reportRef = db.collection('reports').doc(deps.reportId);
            const reportSnap = await tx.get(reportRef);
            if (!reportSnap.exists) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found', {
                    reportId: deps.reportId,
                });
            }
            const reportData = reportSnap.data();
            if (!reportData) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report data missing', {
                    reportId: deps.reportId,
                });
            }
            if (reportData.municipalityId !== deps.actor.claims.municipalityId) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report is not in your municipality');
            }
            const from = reportData.status;
            const to = 'closed';
            if (from !== 'resolved') {
                throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, `closeReport requires status resolved (got: ${from})`, { reportId: deps.reportId, from });
            }
            if (!isValidReportTransition(from, to)) {
                throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'invalid transition', {
                    from,
                    to,
                });
            }
            let smsRecipientPhone;
            let smsLocale = 'tl';
            let smsPublicRef = deps.reportId
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .slice(0, 8);
            const salt = process.env.SMS_MSISDN_HASH_SALT;
            if (salt) {
                const consentSnap = await tx.get(db.collection('report_sms_consent').doc(deps.reportId));
                if (consentSnap.exists) {
                    const consentData = consentSnap.data();
                    if (consentData?.phone) {
                        smsRecipientPhone = consentData.phone;
                        smsLocale = consentData.locale ?? 'tl';
                        const lookupQ = db
                            .collection('report_lookup')
                            .where('reportId', '==', deps.reportId)
                            .limit(1);
                        const lookupSnap = await tx.get(lookupQ);
                        const lookupDoc = lookupSnap.docs[0];
                        smsPublicRef = lookupDoc?.id ?? smsPublicRef;
                    }
                }
            }
            const updates = {
                status: to,
                lastStatusAt: deps.now,
                lastStatusBy: deps.actor.uid,
            };
            if (deps.closureSummary !== undefined) {
                updates.closureSummary = deps.closureSummary;
            }
            tx.update(reportRef, updates);
            const eventRef = db.collection('report_events').doc();
            tx.set(eventRef, {
                eventId: eventRef.id,
                reportId: deps.reportId,
                from,
                to,
                actor: deps.actor.uid,
                // Falls back to 'municipal_admin' when role is undefined (should not happen for municipal_admin callers,
                // but provincial_superadmin tokens may omit role)
                actorRole: deps.actor.claims.role ?? 'municipal_admin',
                at: deps.now,
                correlationId,
                schemaVersion: 1,
            });
            if (salt && smsRecipientPhone) {
                enqueueSms(db, tx, {
                    reportId: deps.reportId,
                    purpose: 'resolution',
                    recipientMsisdn: smsRecipientPhone,
                    locale: smsLocale,
                    publicRef: smsPublicRef,
                    salt,
                    nowMs: deps.now.toMillis(),
                    providerId: 'semaphore',
                });
            }
            const log = logDimension('closeReport');
            log({
                severity: 'INFO',
                code: 'report.closed',
                message: `Report ${deps.reportId} transitioned ${from} → ${to}`,
                data: {
                    reportId: deps.reportId,
                    from,
                    to,
                    actorUid: deps.actor.uid,
                    correlationId,
                    hasClosureSummary: deps.closureSummary !== undefined,
                },
            });
            return { status: to, reportId: deps.reportId };
        });
    });
    return result;
}
export const closeReport = onCall({ region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 }, async (req) => {
    if (!req.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = req.auth.token;
    if (!claims)
        throw new HttpsError('unauthenticated', 'token required');
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required');
    }
    if (claims.active !== true) {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    // municipal_admin requires a municipalityId; provincial_superadmin does not
    if (claims.role === 'municipal_admin' && claims.municipalityId === undefined) {
        throw new HttpsError('permission-denied', 'municipalityId missing from token claims');
    }
    const parsed = closeReportRequestSchema.safeParse(req.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    const rl = await checkRateLimit(adminDb, {
        key: `closeReport:${req.auth.uid}`,
        limit: 60,
        windowSeconds: 60,
        now: Timestamp.now(),
    });
    if (!rl.allowed) {
        throw new HttpsError('resource-exhausted', 'rate limit', {
            retryAfterSeconds: rl.retryAfterSeconds,
        });
    }
    try {
        return await closeReportCore(adminDb, {
            reportId: parsed.data.reportId,
            idempotencyKey: parsed.data.idempotencyKey,
            closureSummary: parsed.data.closureSummary,
            actor: {
                uid: req.auth.uid,
                claims: {
                    role: claims.role,
                    municipalityId: claims.municipalityId,
                    active: claims.active,
                },
            },
            now: Timestamp.now(),
        });
    }
    catch (err) {
        if (err instanceof BantayogError) {
            throw bantayogErrorToHttps(err);
        }
        throw err;
    }
});
//# sourceMappingURL=close-report.js.map