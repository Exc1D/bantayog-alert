import { describe, it, expect, beforeEach } from 'vitest';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { adminDb, rtdb as adminRtdb } from '../../../admin-init.js';
import { dispatchResponderCore } from '../../../domains/dispatches/dispatch-responder.js';
import { dispatchMirrorToReportCore } from '../../../domains/reports/dispatch-mirror-to-report.js';
import { acceptDispatchCore } from '../../../domains/dispatches/accept-dispatch.js';
import { verifyReportCore } from '../../../domains/reports/verify-report.js';
// ---------------------------------------------------------------------------
// Emulator guard — skip if Firestore or RTDB emulator is not actually running
// ---------------------------------------------------------------------------
async function probeFirestore(host, port) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 2000);
        const response = await fetch(`http://${host}:${String(port)}`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return response.status === 200 || response.status === 404;
    }
    catch {
        return false;
    }
}
async function probeRtdb(host, port) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 2000);
        const response = await fetch(`http://${host}:${String(port)}/.json?ns=dummy`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return response.status === 401 || response.status === 404 || response.status === 200;
    }
    catch {
        return false;
    }
}
const firestoreAvailable = await probeFirestore('127.0.0.1', 8081);
const rtdbAvailable = await probeRtdb('127.0.0.1', 9000);
const emulatorAvailable = firestoreAvailable && rtdbAvailable;
if (!firestoreAvailable) {
    console.warn('[adversarial-audit] Firestore emulator unavailable at 127.0.0.1:8081; tests will skip.');
}
if (!rtdbAvailable) {
    console.warn('[adversarial-audit] RTDB emulator unavailable at 127.0.0.1:9000; tests will skip.');
}
const itif = (condition) => (condition ? it : it.skip);
// ---------------------------------------------------------------------------
// Test environment
// ---------------------------------------------------------------------------
// We use the real adminDb which will talk to the emulator if FIRESTORE_EMULATOR_HOST is set.
// This bypasses security rules and avoids cross-SDK Timestamp issues.
beforeEach(async () => {
    if (!emulatorAvailable)
        return;
    // Clear collections manually
    const collections = [
        'reports',
        'report_ops',
        'report_private',
        'dispatches',
        'idempotency_keys',
        'active_accounts',
        'responders',
    ];
    for (const c of collections) {
        const snaps = await adminDb.collection(c).get();
        const batch = adminDb.batch();
        snaps.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
    }
});
// ---------------------------------------------------------------------------
// Seed helpers (using Admin SDK)
// ---------------------------------------------------------------------------
async function seedReportAdmin(reportId, status) {
    await adminDb.collection('reports').doc(reportId).set({
        reportId,
        status,
        municipalityId: 'daet',
        source: 'citizen_pwa',
        severityDerived: 'medium',
        createdAt: FieldValue.serverTimestamp(),
        lastStatusAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
    });
    await adminDb
        .collection('report_ops')
        .doc(reportId)
        .set({
        reportId,
        status,
        severity: 'medium',
        createdAt: FieldValue.serverTimestamp(),
        agencyIds: [],
        activeResponderCount: 0,
        requiresLocationFollowUp: false,
        visibility: { scope: 'municipality', sharedWith: [] },
        updatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
    });
}
async function seedResponderAdmin(uid, municipalityId = 'daet') {
    await adminDb
        .collection('responders')
        .doc(uid)
        .set({
        uid,
        municipalityId,
        agencyId: 'bfp-daet',
        displayName: `Responder ${uid}`,
        isActive: true,
        fcmTokens: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
    });
    // Also seed RTDB shift status
    await adminRtdb.ref(`/responder_index/${municipalityId}/${uid}`).set({
        isOnShift: true,
        updatedAt: Date.now(),
    });
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Adversarial Audit — Proof of Concept', { timeout: 120000 }, () => {
    itif(emulatorAvailable)('BUG #1: Redispatch Deadlock — cannot dispatch new responder if report is "assigned"', async () => {
        const reportId = 'report-deadlock';
        const responderA = 'responder-a';
        const responderB = 'responder-b';
        await seedReportAdmin(reportId, 'verified');
        await seedResponderAdmin(responderA);
        await seedResponderAdmin(responderB);
        // 1. Dispatch Responder A
        await dispatchResponderCore(adminDb, adminRtdb, {
            reportId,
            responderUid: responderA,
            idempotencyKey: crypto.randomUUID(),
            actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
            now: Timestamp.now(),
        });
        const reportSnap = await adminDb.collection('reports').doc(reportId).get();
        expect(reportSnap.data()?.status).toBe('assigned');
        // 2. Try to Dispatch Responder B while status is still 'assigned'
        // This confirms the deadlock if Responder A fails to accept.
        await expect(dispatchResponderCore(adminDb, adminRtdb, {
            reportId,
            responderUid: responderB,
            idempotencyKey: crypto.randomUUID(),
            actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
            now: Timestamp.now(),
        })).rejects.toThrow(/Cannot dispatch from status assigned/);
    });
    itif(emulatorAvailable)('BUG #2: Multi-Dispatch Collision — old dispatch regresses report status', async () => {
        const reportId = 'report-collision';
        const dispatchB = 'dispatch-new';
        // Seed report as on_scene
        await seedReportAdmin(reportId, 'on_scene');
        // 1. Simulate Dispatch B moving to 'en_route' (even though report is on_scene)
        await dispatchMirrorToReportCore({
            db: adminDb,
            dispatchId: dispatchB,
            beforeData: { status: 'acknowledged' },
            afterData: { status: 'en_route', reportId, correlationId: 'corr-new' },
        });
        // 2. VERIFY: Report status regressed from 'on_scene' to 'en_route'
        const reportSnap = await adminDb.collection('reports').doc(reportId).get();
        expect(reportSnap.data()?.status).toBe('en_route');
    });
    itif(emulatorAvailable)('FIXED: Idempotency — retry with different Timestamp returns cached result (fromCache=true)', async () => {
        const responderUid = 'responder-idempotency-fixed';
        const dispatchId = 'dispatch-idempotency-fixed';
        const idempotencyKey = '22222222-2222-2222-2222-222222222222';
        // Seed dispatch
        await adminDb
            .collection('dispatches')
            .doc(dispatchId)
            .set({
            dispatchId,
            status: 'pending',
            reportId: 'report-idempotency-fixed',
            assignedTo: { uid: responderUid, agencyId: 'bfp-daet', municipalityId: 'daet' },
            schemaVersion: 1,
        });
        // 1. First call to acceptDispatch
        const now1 = Timestamp.now();
        const result1 = await acceptDispatchCore(adminDb, {
            dispatchId,
            idempotencyKey,
            actor: { uid: responderUid },
            now: now1,
        });
        expect(result1.status).toBe('accepted');
        expect(result1.fromCache).toBe(false);
        // 2. Retry call from client with different Timestamp
        const now2 = Timestamp.fromMillis(now1.toMillis() + 1000);
        const result2 = await acceptDispatchCore(adminDb, {
            dispatchId,
            idempotencyKey,
            actor: { uid: responderUid },
            now: now2,
        });
        // FIXED: Should succeed and return cached result
        expect(result2.status).toBe('accepted');
        expect(result2.fromCache).toBe(true); // This proves idempotency now works correctly
    });
    itif(emulatorAvailable)('FIXED: PII Scrubbing — verifyReport callable now accepts scrubbedDescription', async () => {
        const reportId = 'report-pii-callable-fixed';
        await seedReportAdmin(reportId, 'new');
        // FIXED: Admin can now pass scrubbedDescription when verifying
        await expect(verifyReportCore(adminDb, {
            reportId,
            scrubbedDescription: 'SCRUBBED: flood at knee height near market',
            idempotencyKey: '33333333-3333-3333-3333-333333333333',
            actor: { uid: 'admin-1', claims: { role: 'municipal_admin', municipalityId: 'daet' } },
            now: Timestamp.now(),
        })).resolves.toMatchObject({ status: 'awaiting_verify', reportId });
    });
});
//# sourceMappingURL=adversarial-audit.test.js.map