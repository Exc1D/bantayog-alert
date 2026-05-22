import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Firestore } from 'firebase-admin/firestore';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { adminDb } from '../../admin-init.js';
import { bantayogErrorToHttps } from '../shared/https-error.js';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
function deriveScope(claims) {
    const role = claims.role;
    if (role === 'municipal_admin')
        return { type: 'municipality', id: claims.municipalityId ?? 'unknown' };
    if (role === 'agency_admin')
        return { type: 'agency', id: claims.agencyId ?? 'unknown' };
    if (role === 'provincial_superadmin')
        return { type: 'province', id: 'province' };
    throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'unknown role');
}
function collectDatesForRange(timeRange) {
    const now = new Date();
    if (timeRange === '1h' || timeRange === '24h') {
        return [now.toISOString().slice(0, 10)];
    }
    const dates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
}
function createEmptyMetrics() {
    return {
        totalDispatches: 0,
        acceptedCount: 0,
        declinedCount: 0,
        escalatedCount: 0,
        needsAdminCount: 0,
        fcmSuccessCount: 0,
        fcmFailureCount: 0,
        totalAcceptSeconds: 0,
        acceptCountWithTimestamps: 0,
    };
}
function accumulateMetrics(accum, data) {
    accum.totalDispatches += data.totalDispatches ?? 0;
    accum.acceptedCount += data.acceptedCount ?? 0;
    accum.declinedCount += data.declinedCount ?? 0;
    accum.escalatedCount += data.escalatedCount ?? 0;
    accum.needsAdminCount += data.needsAdminCount ?? 0;
    accum.fcmSuccessCount += data.fcmSuccessCount ?? 0;
    accum.fcmFailureCount += data.fcmFailureCount ?? 0;
    accum.totalAcceptSeconds += data.totalAcceptSeconds ?? 0;
    accum.acceptCountWithTimestamps += data.acceptCountWithTimestamps ?? 0;
}
export async function getOpsMetricsCore(db, deps) {
    const scope = deriveScope(deps.actor.claims);
    const dates = collectDatesForRange(deps.timeRange);
    const metrics = createEmptyMetrics();
    for (const date of dates) {
        const docId = scope.type === 'province' ? `province_${date}` : `${scope.id}_${date}`;
        const snap = await db.collection('metrics_daily').doc(docId).get();
        if (snap.exists) {
            accumulateMetrics(metrics, snap.data());
        }
    }
    const avgAcceptSeconds = metrics.acceptCountWithTimestamps > 0
        ? Math.round(metrics.totalAcceptSeconds / metrics.acceptCountWithTimestamps)
        : null;
    const totalFcmAttempts = metrics.fcmSuccessCount + metrics.fcmFailureCount;
    const fcmSuccessRate = totalFcmAttempts > 0 ? metrics.fcmSuccessCount / totalFcmAttempts : 0;
    return {
        timeRange: deps.timeRange,
        scope,
        metrics: {
            ...metrics,
            avgAcceptSeconds,
            fcmSuccessRate,
        },
    };
}
const ADMIN_ROLES = ['municipal_admin', 'agency_admin', 'provincial_superadmin'];
export const getOpsMetrics = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    memory: '512MiB',
    maxInstances: 100,
}, async (req) => {
    if (!req.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = req.auth.token;
    if (!ADMIN_ROLES.includes(claims.role)) {
        throw new HttpsError('permission-denied', 'admin required');
    }
    if (claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'account not active');
    }
    const data = req.data;
    if (typeof data !== 'object' || data === null) {
        throw new HttpsError('invalid-argument', 'malformed payload');
    }
    const timeRange = data.timeRange;
    try {
        return await getOpsMetricsCore(adminDb, {
            timeRange,
            actor: {
                claims: {
                    role: claims.role,
                    municipalityId: claims.municipalityId,
                    agencyId: claims.agencyId,
                },
            },
        });
    }
    catch (err) {
        if (err instanceof BantayogError) {
            throw bantayogErrorToHttps(err);
        }
        throw err;
    }
});
//# sourceMappingURL=callables.js.map