import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, isValidReportTransition, logDimension, } from '@bantayog/shared-validators';
import { adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { bantayogErrorToHttps, requireAuth } from './https-error.js';
export const reopenReportSchema = z
    .object({
    reportId: z.string().min(1).max(128),
    reason: z.string().trim().min(1).max(500),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    idempotencyKey: z.string().uuid(),
})
    .strict();
const log = logDimension('reopenReport');
export async function reopenReportCore(db, deps) {
    const correlationId = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `reopenReport:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: idempotentPayload,
        now: () => deps.now.toMillis(),
    }, async () => {
        const rl = await checkRateLimit(db, {
            key: `reopenReport:${deps.actor.uid}`,
            limit: 30,
            windowSeconds: 60,
            now: deps.now,
        });
        if (!rl.allowed) {
            throw new BantayogError(BantayogErrorCode.RATE_LIMITED, 'rate limit exceeded', {
                retryAfterSeconds: rl.retryAfterSeconds,
            });
        }
        return db.runTransaction(async (tx) => {
            const reportRef = db.collection('reports').doc(deps.reportId);
            const reportOpsRef = db.collection('report_ops').doc(deps.reportId);
            const [reportSnap, reportOpsSnap] = await Promise.all([
                tx.get(reportRef),
                tx.get(reportOpsRef),
            ]);
            if (!reportSnap.exists) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found');
            }
            const report = reportSnap.data();
            const actorMuniIds = [];
            if (deps.actor.claims.municipalityId) {
                actorMuniIds.push(deps.actor.claims.municipalityId);
            }
            if (deps.actor.claims.permittedMunicipalityIds?.length) {
                actorMuniIds.push(...deps.actor.claims.permittedMunicipalityIds);
            }
            if (actorMuniIds.length > 0 &&
                typeof report.municipalityId === 'string' &&
                !actorMuniIds.includes(report.municipalityId)) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality');
            }
            const from = report.status;
            const to = 'reopened';
            if (from !== 'closed') {
                throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, `reopenReport requires status closed (got: ${from})`);
            }
            if (!isValidReportTransition(from, to)) {
                throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'invalid transition', { from, to });
            }
            const nowMs = deps.now.toMillis();
            const updates = {
                status: to,
                lastStatusAt: nowMs,
                lastStatusBy: deps.actor.uid,
                reopenedAt: nowMs,
                reopenedBy: deps.actor.uid,
                reopenedReason: deps.reason,
            };
            tx.update(reportRef, updates);
            if (reportOpsSnap.exists) {
                tx.update(reportOpsRef, {
                    status: to,
                    reopenedAt: nowMs,
                    reopenedBy: deps.actor.uid,
                    reopenedReason: deps.reason,
                    updatedAt: nowMs,
                });
            }
            const eventRef = db.collection('report_events').doc();
            tx.set(eventRef, {
                eventId: eventRef.id,
                reportId: deps.reportId,
                from,
                to,
                actor: deps.actor.uid,
                actorRole: deps.actor.claims.role ?? 'municipal_admin',
                reason: deps.reason,
                at: nowMs,
                correlationId,
                schemaVersion: 1,
            });
            log({
                severity: 'INFO',
                code: 'report.reopened',
                message: `Report ${deps.reportId} reopened`,
                data: {
                    reportId: deps.reportId,
                    from,
                    to,
                    actorUid: deps.actor.uid,
                    correlationId,
                },
            });
            return { reportId: deps.reportId, status: to };
        });
    });
    return result;
}
export const reopenReport = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: process.env.NODE_ENV === 'production',
    timeoutSeconds: 10,
    minInstances: 1,
}, async (request) => {
    const actor = requireAuth(request, ['municipal_admin', 'provincial_superadmin']);
    if (actor.claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    const parsed = reopenReportSchema.safeParse(request.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    try {
        return await reopenReportCore(adminDb, {
            reportId: parsed.data.reportId,
            reason: parsed.data.reason,
            idempotencyKey: parsed.data.idempotencyKey,
            actor: {
                uid: actor.uid,
                claims: {
                    ...(typeof actor.claims.role === 'string' && { role: actor.claims.role }),
                    ...(typeof actor.claims.municipalityId === 'string' && {
                        municipalityId: actor.claims.municipalityId,
                    }),
                    ...(Array.isArray(actor.claims.permittedMunicipalityIds) && {
                        permittedMunicipalityIds: actor.claims.permittedMunicipalityIds.filter((id) => typeof id === 'string'),
                    }),
                },
            },
            now: Timestamp.now(),
        });
    }
    catch (err) {
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
//# sourceMappingURL=reopen-report.js.map