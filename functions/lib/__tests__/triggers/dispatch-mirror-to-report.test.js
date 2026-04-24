/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { dispatchMirrorToReportCore } from '../../triggers/dispatch-mirror-to-report.js';
const ts = 1713350400000;
process.env.FIRESTORE_EMULATOR_HOST ??= 'localhost:8081';
const appName = 'dispatch-mirror-test';
const app = getApps().find((a) => a.name === appName) ??
    initializeApp({ projectId: 'dispatch-mirror-test' }, appName);
const adminDb = getFirestore(app);
// ---------------------------------------------------------------------------
// Test environment
// ---------------------------------------------------------------------------
let testEnv;
beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'dispatch-mirror-test',
        firestore: { host: 'localhost', port: 8081 },
    });
    await testEnv.clearFirestore();
});
afterEach(async () => {
    await testEnv.cleanup();
});
async function withAdminDb(fn) {
    return fn(adminDb);
}
// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
/** Seeds a report at a given status using JS SDK via withSecurityRulesDisabled. */
async function seedReportAtStatusJS(reportId, status) {
    await adminDb.collection('reports').doc(reportId).set({
        reportId,
        status,
        municipalityId: 'daet',
        source: 'citizen_pwa',
        severityDerived: 'medium',
        createdAt: ts,
        lastStatusAt: ts,
        schemaVersion: 1,
    });
    await adminDb.collection('report_private').doc(reportId).set({
        reportId,
        reporterUid: 'reporter-1',
        createdAt: ts,
        schemaVersion: 1,
    });
    await adminDb.collection('report_ops').doc(reportId).set({
        reportId,
        verifyQueuePriority: 0,
        assignedMunicipalityAdmins: [],
        schemaVersion: 1,
    });
}
/** Seeds a dispatch using JS SDK via withSecurityRulesDisabled. */
async function seedDispatchJS(dispatchId, reportId, status, correlationId) {
    await adminDb
        .collection('dispatches')
        .doc(dispatchId)
        .set({
        dispatchId,
        reportId,
        status,
        assignedTo: {
            uid: 'responder-1',
            agencyId: 'bfp-daet',
            municipalityId: 'daet',
        },
        dispatchedAt: ts,
        lastStatusAt: ts,
        correlationId: correlationId ?? crypto.randomUUID(),
        schemaVersion: 1,
    });
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('dispatchMirrorToReport', () => {
    it('mirrors accepted → reports.status=acknowledged', async () => {
        const { reportId, dispatchId } = await seedPendingDispatch();
        // Simulate dispatch transitioning from pending → accepted
        await withAdminDb(async (db) => {
            await dispatchMirrorToReportCore({
                db,
                dispatchId,
                beforeData: { status: 'pending' },
                afterData: { status: 'accepted', reportId, correlationId: crypto.randomUUID() },
            });
            const r = await db.collection('reports').doc(reportId).get();
            expect(r.data()?.status).toBe('acknowledged');
        });
    });
    it('appends report_events on each mirrored change', async () => {
        const { reportId, dispatchId } = await seedAcceptedDispatch();
        await withAdminDb(async (db) => {
            await dispatchMirrorToReportCore({
                db,
                dispatchId,
                beforeData: { status: 'accepted' },
                afterData: { status: 'en_route', reportId, correlationId: crypto.randomUUID() },
            });
            const events = await db
                .collection('report_events')
                .where('reportId', '==', reportId)
                .where('to', '==', 'en_route')
                .get();
            expect(events.docs.length).toBeGreaterThan(0);
            const eventDoc = events.docs[0];
            expect(eventDoc.data().from).toBe('acknowledged');
            expect(eventDoc.data().to).toBe('en_route');
            expect(eventDoc.data().actor).toBe('system:dispatchMirrorToReport');
        });
    });
    it('no-ops when dispatch.status == cancelled', async () => {
        const { reportId, dispatchId } = await seedAcceptedDispatch();
        await withAdminDb(async (db) => {
            const beforeSnap = await db.collection('reports').doc(reportId).get();
            const beforeStatus = beforeSnap.data()?.status;
            // cancelled dispatch should not mirror
            await dispatchMirrorToReportCore({
                db,
                dispatchId,
                beforeData: { status: 'accepted' },
                afterData: { status: 'cancelled', reportId, correlationId: crypto.randomUUID() },
            });
            const afterSnap = await db.collection('reports').doc(reportId).get();
            const afterStatus = afterSnap.data()?.status;
            expect(afterStatus).toBe(beforeStatus);
        });
    });
    it('skips if reports/{id} is missing (delete race)', async () => {
        const dispatchId = `dispatch-${crypto.randomUUID()}`;
        await seedDispatchJS(dispatchId, 'nonexistent-report', 'pending');
        await withAdminDb(async (db) => {
            // Should not throw — trigger skips gracefully when report is missing
            await dispatchMirrorToReportCore({
                db,
                dispatchId,
                beforeData: { status: 'pending' },
                afterData: {
                    status: 'accepted',
                    reportId: 'nonexistent-report',
                    correlationId: crypto.randomUUID(),
                },
            });
        });
    });
    it('reverts declined dispatches back to verified and clears currentDispatchId', async () => {
        const { reportId, dispatchId } = await seedAcceptedDispatch();
        await withAdminDb(async (db) => {
            await dispatchMirrorToReportCore({
                db,
                dispatchId,
                beforeData: { status: 'accepted' },
                afterData: { status: 'declined', reportId, correlationId: crypto.randomUUID() },
            });
            const reportSnap = await db.collection('reports').doc(reportId).get();
            expect(reportSnap.data()?.status).toBe('verified');
            expect(reportSnap.data()?.currentDispatchId).toBeNull();
        });
    });
    it('reverts timed out dispatches back to verified and clears currentDispatchId', async () => {
        const { reportId, dispatchId } = await seedAcceptedDispatch();
        await withAdminDb(async (db) => {
            await dispatchMirrorToReportCore({
                db,
                dispatchId,
                beforeData: { status: 'accepted' },
                afterData: { status: 'timed_out', reportId, correlationId: crypto.randomUUID() },
            });
            const reportSnap = await db.collection('reports').doc(reportId).get();
            expect(reportSnap.data()?.status).toBe('verified');
            expect(reportSnap.data()?.currentDispatchId).toBeNull();
        });
    });
});
// ---------------------------------------------------------------------------
// Seed helpers for specific dispatch states
// ---------------------------------------------------------------------------
async function seedPendingDispatch() {
    const reportId = `report-${crypto.randomUUID()}`;
    const dispatchId = `dispatch-${crypto.randomUUID()}`;
    await seedReportAtStatusJS(reportId, 'assigned');
    await seedDispatchJS(dispatchId, reportId, 'pending');
    return { reportId, dispatchId };
}
async function seedAcceptedDispatch() {
    const reportId = `report-${crypto.randomUUID()}`;
    const dispatchId = `dispatch-${crypto.randomUUID()}`;
    await seedReportAtStatusJS(reportId, 'acknowledged');
    await seedDispatchJS(dispatchId, reportId, 'accepted');
    return { reportId, dispatchId };
}
//# sourceMappingURL=dispatch-mirror-to-report.test.js.map