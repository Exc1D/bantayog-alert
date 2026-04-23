import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode, logDimension } from '@bantayog/shared-validators';
import { adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { checkRateLimit } from '../services/rate-limit.js';
import { bantayogErrorToHttps } from './https-error.js';
const REJECT_REASONS = [
    'obviously_false',
    'duplicate',
    'test_submission',
    'insufficient_detail',
];
const InputSchema = z
    .object({
    reportId: z.string().min(1).max(128),
    reason: z.enum(REJECT_REASONS),
    notes: z.string().max(500).optional(),
    idempotencyKey: z.uuid(),
})
    .strict();
const log = logDimension('rejectReport');
export async function rejectReportCore(db, deps) {
    const correlationId = crypto.randomUUID();
    const { result } = await withIdempotency(db, {
        key: `rejectReport:${deps.actor.uid}:${deps.idempotencyKey}`,
        payload: deps,
        now: () => deps.now.toMillis(),
    }, async () => db.runTransaction(async (tx) => {
        const reportRef = db.collection('reports').doc(deps.reportId);
        const snap = await tx.get(reportRef);
        if (!snap.exists) {
            throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found');
        }
        const report = snap.data();
        if (report.municipalityId !== deps.actor.claims.municipalityId) {
            throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality');
        }
        const from = report.status;
        const to = 'cancelled_false_report';
        if (from !== 'awaiting_verify') {
            throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, `rejectReport is only valid from awaiting_verify, got ${from}`, { reportId: deps.reportId, from });
        }
        tx.update(reportRef, {
            status: to,
            lastStatusAt: deps.now,
            lastStatusBy: deps.actor.uid,
            rejectionReason: deps.reason,
        });
        const incRef = db.collection('moderation_incidents').doc();
        tx.set(incRef, {
            incidentId: incRef.id,
            reportId: deps.reportId,
            reason: deps.reason,
            notes: deps.notes ?? null,
            actor: deps.actor.uid,
            actorRole: deps.actor.claims.role ?? 'municipal_admin',
            at: deps.now,
            correlationId,
            schemaVersion: 1,
        });
        const evRef = db.collection('report_events').doc();
        tx.set(evRef, {
            eventId: evRef.id,
            reportId: deps.reportId,
            from,
            to,
            actor: deps.actor.uid,
            actorRole: deps.actor.claims.role ?? 'municipal_admin',
            at: deps.now,
            correlationId,
            schemaVersion: 1,
        });
        log({
            severity: 'INFO',
            code: 'report.rejected',
            message: `Report ${deps.reportId} rejected as ${deps.reason}`,
            data: {
                correlationId,
                reportId: deps.reportId,
                reason: deps.reason,
                actorUid: deps.actor.uid,
            },
        });
        return { status: to, reportId: deps.reportId };
    }));
    return result;
}
export const rejectReport = onCall({ region: 'asia-southeast1', enforceAppCheck: true, maxInstances: 100 }, async (req) => {
    if (!req.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = req.auth.token;
    if (!claims)
        throw new HttpsError('unauthenticated', 'sign-in required');
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required');
    }
    if (claims.active !== true)
        throw new HttpsError('permission-denied', 'account is not active');
    const parsed = InputSchema.safeParse(req.data);
    if (!parsed.success)
        throw new HttpsError('invalid-argument', 'malformed payload');
    const rl = await checkRateLimit(adminDb, {
        key: `rejectReport:${req.auth.uid}`,
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
        return await rejectReportCore(adminDb, {
            reportId: parsed.data.reportId,
            reason: parsed.data.reason,
            notes: parsed.data.notes,
            idempotencyKey: parsed.data.idempotencyKey,
            actor: {
                uid: req.auth.uid,
                claims: {
                    role: claims.role,
                    municipalityId: claims.municipalityId,
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
//# sourceMappingURL=reject-report.js.map