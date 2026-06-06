import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators';
import { adminDb } from '../../admin-init.js';
import { withIdempotency } from '../../idempotency/guard.js';
import { checkRateLimit } from '../shared/rate-limit.js';
import { bantayogErrorToHttps } from '../shared/https-error.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { isAccountActive } from '../ops/admin-auth.js';
const InputSchema = z
    .object({
    reportId: z.string().min(1).max(128),
    idempotencyKey: z.uuid(),
})
    .strict();
const CANCELLABLE_STATUSES = ['new', 'awaiting_verify'];
const log = logDimension('cancelReportByCitizen');
export async function cancelReportByCitizenCore(db, deps) {
    const correlationId = crypto.randomUUID();
    const { result } = await withIdempotency(db, {
        key: `cancelReportByCitizen:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: { reportId: deps.reportId, actorUid: deps.actor.uid },
        now: () => deps.now.toMillis(),
    }, async () => {
        return db.runTransaction(async (tx) => {
            const reportRef = db.collection('reports').doc(deps.reportId);
            const snap = await tx.get(reportRef);
            if (!snap.exists) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found');
            }
            const report = snap.data();
            const status = report.status;
            if (!CANCELLABLE_STATUSES.includes(status)) {
                throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, `cancelReportByCitizen is only valid from new or awaiting_verify, got ${status}`, { reportId: deps.reportId, status });
            }
            const privateRef = db.collection('report_private').doc(deps.reportId);
            const privateSnap = await tx.get(privateRef);
            const reporterUid = privateSnap.data()?.reporterUid;
            if (reporterUid !== deps.actor.uid) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'You do not own this report');
            }
            const opsRef = db.collection('report_ops').doc(deps.reportId);
            const opsSnap = await tx.get(opsRef);
            const nowMs = deps.now.toMillis();
            tx.update(reportRef, {
                status: 'cancelled',
                cancelReason: 'citizen_withdrew',
                visibilityClass: 'internal',
                withdrawnAt: nowMs,
                withdrawnBy: deps.actor.uid,
                cancelledAt: nowMs,
                updatedAt: nowMs,
                lastStatusAt: nowMs,
                lastStatusBy: deps.actor.uid,
            });
            const opsUpdate = {
                status: 'cancelled',
                cancelReason: 'citizen_withdrew',
                withdrawnAt: nowMs,
                withdrawnBy: deps.actor.uid,
                updatedAt: nowMs,
                lastStatusAt: nowMs,
                lastStatusBy: deps.actor.uid,
            };
            if (opsSnap.exists) {
                tx.update(opsRef, opsUpdate);
            }
            else {
                tx.create(opsRef, {
                    reportId: deps.reportId,
                    schemaVersion: 1,
                    ...opsUpdate,
                });
            }
            const eventRef = db.collection('report_events').doc();
            tx.set(eventRef, {
                eventId: eventRef.id,
                reportId: deps.reportId,
                from: status,
                to: 'citizen_cancelled',
                actor: deps.actor.uid,
                actorRole: deps.actor.claims.role ?? 'citizen',
                at: nowMs,
                correlationId,
                schemaVersion: 1,
            });
            log({
                severity: 'INFO',
                code: 'report.citizen_cancelled',
                message: `Report ${deps.reportId} cancelled by citizen ${deps.actor.uid}`,
                data: {
                    correlationId,
                    reportId: deps.reportId,
                    actorUid: deps.actor.uid,
                },
            });
            return { reportId: deps.reportId };
        });
    });
    return result;
}
export const cancelReportByCitizen = onCall({ region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck(), maxInstances: 100 }, async (req) => {
    if (!req.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = req.auth.token;
    if (!claims)
        throw new HttpsError('unauthenticated', 'sign-in required');
    if (claims.role !== 'citizen') {
        throw new HttpsError('permission-denied', 'citizen role required');
    }
    if (!isAccountActive(claims)) {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    const parsed = InputSchema.safeParse(req.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    const rl = await checkRateLimit(adminDb, {
        key: `cancelReportByCitizen:${req.auth.uid}`,
        limit: 30,
        windowSeconds: 60,
        now: Timestamp.now(),
    });
    if (!rl.allowed) {
        throw new HttpsError('resource-exhausted', 'rate limit', {
            retryAfterSeconds: rl.retryAfterSeconds,
        });
    }
    try {
        return await cancelReportByCitizenCore(adminDb, {
            reportId: parsed.data.reportId,
            idempotencyKey: parsed.data.idempotencyKey,
            actor: {
                uid: req.auth.uid,
                claims: {
                    role: claims.role,
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
//# sourceMappingURL=cancel-report-by-citizen.js.map