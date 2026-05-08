import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types';
import { adminDb } from '../admin-init.js';
const listScopedOperationsMapSchema = z.object({}).strict();
function readClaimString(claims, key) {
    const value = claims[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
function toIncidentPayload(reportId, reportData, opsData) {
    const location = reportData.publicLocation;
    const lat = location?.lat;
    const lng = location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number')
        return null;
    const submittedAt = typeof reportData.submittedAt === 'number'
        ? reportData.submittedAt
        : typeof reportData.createdAt === 'number'
            ? reportData.createdAt
            : Date.now();
    const updatedAt = typeof reportData.updatedAt === 'number'
        ? reportData.updatedAt
        : typeof reportData.lastStatusAt === 'number'
            ? reportData.lastStatusAt
            : submittedAt;
    return {
        reportId,
        report: {
            municipalityId: typeof reportData.municipalityId === 'string' ? reportData.municipalityId : 'unknown',
            ...(typeof reportData.municipalityLabel === 'string'
                ? { municipalityLabel: reportData.municipalityLabel }
                : {}),
            ...(typeof reportData.barangayId === 'string' ? { barangayId: reportData.barangayId } : {}),
            ...(typeof reportData.reportType === 'string' ? { reportType: reportData.reportType } : {}),
            ...(typeof reportData.severity === 'string'
                ? { severity: reportData.severity }
                : typeof reportData.severityDerived === 'string'
                    ? { severity: reportData.severityDerived }
                    : {}),
            ...(typeof reportData.status === 'string' ? { status: reportData.status } : {}),
            ...(typeof reportData.description === 'string'
                ? { description: reportData.description }
                : {}),
            publicLocation: { lat, lng },
            submittedAt,
            updatedAt,
            ...(typeof opsData.activeResponderCount === 'number'
                ? { activeResponderCount: opsData.activeResponderCount }
                : {}),
        },
    };
}
export async function listScopedOperationsMapCore(db, actor) {
    const role = readClaimString(actor.claims, 'role');
    const municipalityId = readClaimString(actor.claims, 'municipalityId');
    const agencyId = readClaimString(actor.claims, 'agencyId');
    const accountStatus = typeof actor.claims.accountStatus === 'string' ? actor.claims.accountStatus : undefined;
    const isActive = actor.claims.active === true || accountStatus === 'active';
    if (role !== 'municipal_admin' && role !== 'agency_admin') {
        throw new HttpsError('permission-denied', 'municipal_admin or agency_admin required');
    }
    if (!isActive) {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    if (role === 'municipal_admin' && !municipalityId) {
        throw new HttpsError('permission-denied', 'municipalityId is required');
    }
    if (role === 'agency_admin' && !agencyId) {
        throw new HttpsError('permission-denied', 'agencyId is required');
    }
    const opsQuery = role === 'agency_admin'
        ? db
            .collection('report_ops')
            .where('agencyIds', 'array-contains', agencyId)
            .where('status', 'in', ACTIVE_REPORT_STATUSES)
            .orderBy('createdAt', 'desc')
            .limit(100)
        : db
            .collection('report_ops')
            .where('municipalityId', '==', municipalityId)
            .where('status', 'in', ACTIVE_REPORT_STATUSES)
            .orderBy('createdAt', 'desc')
            .limit(100);
    const opsSnap = await opsQuery.get();
    const reportRefs = opsSnap.docs.map((opsDoc) => db.collection('reports').doc(opsDoc.id));
    const reportSnaps = reportRefs.length > 0 ? await db.getAll(...reportRefs) : [];
    const incidents = opsSnap.docs.map((opsDoc, i) => {
        const reportSnap = reportSnaps[i];
        if (!reportSnap?.exists)
            return null;
        return toIncidentPayload(opsDoc.id, reportSnap.data() ?? {}, opsDoc.data());
    });
    return {
        incidents: incidents.filter((item) => item !== null),
    };
}
export const listScopedOperationsMap = onCall({
    region: 'asia-southeast1',
    enforceAppCheck: true,
    cors: ['http://localhost:5174', 'http://localhost:5175'],
}, async (req) => {
    if (!req.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const claims = req.auth.token;
    if (!claims)
        throw new HttpsError('unauthenticated', 'token required');
    if (claims.accountStatus !== 'active') {
        throw new HttpsError('permission-denied', 'account is not active');
    }
    if (claims.role !== 'municipal_admin' && claims.role !== 'agency_admin') {
        throw new HttpsError('permission-denied', 'municipal_admin or agency_admin required');
    }
    const parsed = listScopedOperationsMapSchema.safeParse(req.data ?? {});
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'malformed payload');
    }
    return listScopedOperationsMapCore(adminDb, {
        uid: req.auth.uid,
        claims: {
            role: claims.role,
            ...(typeof claims.municipalityId === 'string'
                ? { municipalityId: claims.municipalityId }
                : {}),
            ...(typeof claims.agencyId === 'string' ? { agencyId: claims.agencyId } : {}),
            ...(typeof claims.accountStatus === 'string'
                ? { accountStatus: claims.accountStatus }
                : {}),
            ...(claims.active === true ? { active: true } : {}),
        },
    });
});
//# sourceMappingURL=list-scoped-operations-map.js.map