import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, isValidReportTransition, } from '@bantayog/shared-validators';
import { bantayogErrorToHttps } from './https-error.js';
import { adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { logDimension } from '@bantayog/shared-validators';
const InputSchema = z
    .object({
    reportId: z.string().min(1).max(128),
    scrubbedDescription: z.string().min(1).max(2000).optional(),
    idempotencyKey: z.uuid(),
})
    .strict();
export async function verifyReportCore(db, deps) {
    const correlationId = crypto.randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { now: _now, ...idempotentPayload } = deps;
    const { result } = await withIdempotency(db, {
        key: `verifyReport:${deps.actor.uid}:${deps.idempotencyKey}`,
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
            const report = reportData;
            if (report.municipalityId !== deps.actor.claims.municipalityId) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report is not in your municipality');
            }
            const from = report.status;
            let to;
            if (from === 'new')
                to = 'awaiting_verify';
            else if (from === 'awaiting_verify')
                to = 'verified';
            else {
                throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, `verifyReport cannot advance from status ${from}`, { reportId: deps.reportId, from });
            }
            if (!isValidReportTransition(from, to)) {
                throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'invalid transition', {
                    from,
                    to,
                });
            }
            const updates = {
                status: to,
                lastStatusAt: deps.now.toMillis(),
                lastStatusBy: deps.actor.uid,
                updatedAt: deps.now.toMillis(),
            };
            if (deps.scrubbedDescription) {
                updates.description = deps.scrubbedDescription;
            }
            if (to === 'verified') {
                updates.verifiedBy = deps.actor.uid;
                updates.verifiedAt = deps.now.toMillis();
                updates.visibilityClass = 'public_alertable';
            }
            tx.update(reportRef, updates);
            const eventRef = db.collection('report_events').doc();
            tx.set(eventRef, {
                eventId: eventRef.id,
                reportId: deps.reportId,
                from,
                to,
                actor: deps.actor.uid,
                actorRole: deps.actor.claims.role ?? 'municipal_admin',
                at: deps.now.toMillis(),
                correlationId,
                schemaVersion: 1,
            });
            const log = logDimension('verifyReport');
            log({
                severity: 'INFO',
                code: 'report.verified',
                message: `Report ${deps.reportId} transitioned ${from} → ${to}`,
                data: { reportId: deps.reportId, from, to, actorUid: deps.actor.uid, correlationId },
            });
            return { status: to, reportId: deps.reportId, updatedAt: deps.now.toMillis() };
        });
    });
    return result;
}
export const verifyReport = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: true,
    maxInstances: 100,
    cors: ['http://localhost:5175'],
}, async (req) => {
    if (!req.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = req.auth.token;
    if (!claims)
        throw new HttpsError('unauthenticated', 'sign-in required');
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required');
    }
    if (claims.active !== true) {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    const parsed = InputSchema.safeParse(req.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    const rl = await checkRateLimit(adminDb, {
        key: `verifyReport:${req.auth.uid}`,
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
        return await verifyReportCore(adminDb, {
            reportId: parsed.data.reportId,
            ...(parsed.data.scrubbedDescription !== undefined && {
                scrubbedDescription: parsed.data.scrubbedDescription,
            }),
            idempotencyKey: parsed.data.idempotencyKey,
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
//# sourceMappingURL=verify-report.js.map