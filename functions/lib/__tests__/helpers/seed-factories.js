import {} from '@firebase/rules-unit-testing';
import { setDoc, doc } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
export const ts = 1713350400000;
/**
 * Seeds an active_accounts document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export async function seedActiveAccount(env, opts) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'active_accounts', opts.uid), {
            uid: opts.uid,
            role: opts.role,
            accountStatus: opts.accountStatus ?? 'active',
            municipalityId: opts.municipalityId ?? null,
            agencyId: opts.agencyId ?? null,
            permittedMunicipalityIds: opts.permittedMunicipalityIds ?? [],
            mfaEnrolled: true,
            lastClaimIssuedAt: ts,
            updatedAt: ts,
        });
    });
}
export function staffClaims(opts) {
    return {
        role: opts.role,
        accountStatus: opts.accountStatus ?? 'active',
        municipalityId: opts.municipalityId ?? null,
        agencyId: opts.agencyId ?? null,
        permittedMunicipalityIds: opts.permittedMunicipalityIds ?? [],
    };
}
/**
 * Seeds reports + report_ops + report_private using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export async function seedReport(env, reportId, overrides = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'reports', reportId), {
            municipalityId: 'daet',
            reporterRole: 'citizen',
            reportType: 'flood',
            severity: 'high',
            status: 'verified',
            mediaRefs: [],
            description: 'seeded',
            submittedAt: ts,
            retentionExempt: false,
            visibilityClass: 'internal',
            visibility: { scope: 'municipality', sharedWith: [] },
            source: 'web',
            hasPhotoAndGPS: false,
            schemaVersion: 1,
            ...overrides,
        });
        await setDoc(doc(db, 'report_ops', reportId), {
            municipalityId: 'daet',
            status: 'verified',
            severity: 'high',
            createdAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            visibility: { scope: 'municipality', sharedWith: [] },
            updatedAt: ts,
            schemaVersion: 1,
            ...overrides.opsOverrides,
        });
        await setDoc(doc(db, 'report_private', reportId), {
            municipalityId: 'daet',
            reporterUid: 'citizen-1',
            isPseudonymous: true,
            publicTrackingRef: 'ref-12345',
            createdAt: ts,
            schemaVersion: 1,
        });
    });
}
/**
 * Seeds an agencies document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export async function seedAgency(env, agencyId, overrides = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'agencies', agencyId), {
            municipalityId: 'daet',
            name: 'Test Agency',
            agencyType: 'bfp',
            contactNumber: '+1234567890',
            isActive: true,
            createdAt: ts,
            schemaVersion: 1,
            ...overrides,
        });
    });
}
/**
 * Seeds a users document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export async function seedUser(env, userId, overrides = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users', userId), {
            uid: userId,
            municipalityId: 'daet',
            name: 'Test User',
            email: 'test@example.com',
            phoneNumber: '+1234567890',
            isActive: true,
            createdAt: ts,
            schemaVersion: 1,
            ...overrides,
        });
    });
}
/**
 * Seeds a responders document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export async function seedResponder(env, responderId, overrides = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'responders', responderId), {
            uid: responderId,
            municipalityId: 'daet',
            name: 'Test Responder',
            phoneNumber: '+1234567890',
            isActive: true,
            agencyId: null,
            currentStatus: 'available',
            lastLocationUpdate: ts,
            createdAt: ts,
            schemaVersion: 1,
            ...overrides,
        });
    });
}
/**
 * Seeds a dispatches document using RulesTestEnvironment context.
 * Use with env.withSecurityRulesDisabled() — not for Firestore admin SDK use.
 */
export async function seedDispatchRT(env, dispatchId, overrides = {}) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        // Extract assignedTo separately so we can merge with defaults instead of overwriting
        const { assignedTo: assignedToOverride, ...restOverrides } = overrides;
        const mergedAssignedTo = {
            uid: assignedToOverride?.uid ?? '',
            agencyId: assignedToOverride?.agencyId ?? 'agency-1',
            municipalityId: assignedToOverride?.municipalityId ?? 'daet',
        };
        await setDoc(doc(db, 'dispatches', dispatchId), {
            dispatchId,
            municipalityId: 'daet',
            reportId: 'report-1',
            agencyId: 'agency-1',
            priority: 'high',
            status: 'pending',
            assignedResponderUids: [],
            createdAt: ts,
            updatedAt: ts,
            schemaVersion: 1,
            ...restOverrides,
            // assignedTo placed last: restOverrides cannot contain it (destructured out above),
            // so mergedAssignedTo always wins
            assignedTo: mergedAssignedTo,
        });
    });
}
/**
 * Seeds a report at a specific lifecycle status using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 * For mid-lifecycle states (new, awaiting_verify, verified) that bypass processInboxItem.
 */
export async function seedReportAtStatus(db, status, o = {}) {
    const reportId = o.reportId ?? db.collection('reports').doc().id;
    const municipalityId = o.municipalityId ?? 'daet';
    const municipalityLabel = o.municipalityLabel ?? 'Daet';
    const now = Timestamp.now();
    await db
        .collection('reports')
        .doc(reportId)
        .set({
        reportId,
        status,
        municipalityId,
        municipalityLabel,
        source: 'citizen_pwa',
        severityDerived: o.severity ?? 'medium',
        correlationId: crypto.randomUUID(),
        createdAt: now,
        lastStatusAt: now,
        lastStatusBy: 'system:seed',
        schemaVersion: 1,
    });
    await db
        .collection('report_private')
        .doc(reportId)
        .set({
        reportId,
        reporterUid: o.reporterUid ?? 'reporter-1',
        rawDescription: 'Seed description',
        coordinatesPrecise: { lat: 14.1134, lng: 122.9554 },
        schemaVersion: 1,
    });
    await db.collection('report_ops').doc(reportId).set({
        reportId,
        verifyQueuePriority: 0,
        assignedMunicipalityAdmins: [],
        schemaVersion: 1,
    });
    if (o.reporterContact) {
        await db
            .collection('report_sms_consent')
            .doc(reportId)
            .set({
            reportId,
            phone: o.reporterContact.phone,
            locale: o.reporterContact.locale ?? 'tl',
            smsConsent: true,
            createdAt: now.toMillis(),
            schemaVersion: 1,
        });
    }
    return { reportId };
}
/**
 * Seeds a responders document using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 */
export async function seedResponderDoc(db, o) {
    await db
        .collection('responders')
        .doc(o.uid)
        .set({
        uid: o.uid,
        municipalityId: o.municipalityId,
        agencyId: o.agencyId,
        displayName: o.displayName ?? `Responder ${o.uid}`,
        isActive: o.isActive,
        fcmTokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: 1,
    });
}
/**
 * Seeds a responder shift index using Firebase Realtime Database admin SDK directly.
 * Use in Cloud Functions context — not for RulesTestEnvironment RTDB context.
 */
export async function seedResponderShift(rtdb, municipalityId, uid, isOnShift) {
    await rtdb
        .ref(`/responder_index/${municipalityId}/${uid}`)
        .set({ isOnShift, updatedAt: Date.now() });
}
/**
 * Seeds a dispatch document using Firestore admin SDK directly.
 * Use with withSecurityRulesDisabled() or in Cloud Functions — not for RulesTestEnvironment context.
 */
export async function seedDispatch(db, o) {
    const dispatchId = o.dispatchId ?? db.collection('dispatches').doc().id;
    const now = Timestamp.now();
    await db
        .collection('dispatches')
        .doc(dispatchId)
        .set({
        dispatchId,
        reportId: o.reportId,
        status: o.status ?? 'pending',
        assignedTo: {
            uid: o.responderUid,
            agencyId: o.agencyId ?? 'bfp-daet',
            municipalityId: o.municipalityId ?? 'daet',
        },
        dispatchedAt: now,
        lastStatusAt: now,
        acknowledgementDeadlineAt: Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000),
        correlationId: crypto.randomUUID(),
        schemaVersion: 1,
    });
    return { dispatchId };
}
//# sourceMappingURL=seed-factories.js.map