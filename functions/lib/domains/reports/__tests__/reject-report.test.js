import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {} from '@firebase/rules-unit-testing';
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
import { withFirestoreRulesDisabled } from '../../../__tests__/helpers/firestore-emulator-context.js';
vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn(() => ({})),
}));
import { rejectReportCore } from '../reject-report.js';
import { seedReportAtStatus, seedActiveAccount, staffClaims, } from '../../../__tests__/helpers/seed-factories.js';
import { Timestamp } from 'firebase-admin/firestore';
let testEnv;
let available = false;
beforeAll(async () => {
    await initializeRejectReportTestEnvironment();
});
beforeEach(async () => {
    await clearRejectReportFirestore();
});
afterAll(async () => {
    await testEnv?.cleanup();
});
async function initializeRejectReportTestEnvironment() {
    const guarded = await guardInitTestEnvironment({
        projectId: 'reject-report-test',
        firestore: { host: '127.0.0.1', port: 8081 },
    }, 'reject-report');
    testEnv = guarded.env;
    available = guarded.available;
    if (!available)
        return;
}
async function clearRejectReportFirestore() {
    if (!available || !testEnv)
        return;
    await testEnv.clearFirestore();
}
async function seedDaetMunicipalAdmin(env) {
    await seedActiveAccount(env, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
    });
}
function daetMunicipalAdminActor() {
    return {
        uid: 'admin-1',
        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    };
}
async function expectMunicipalRejectFailedPrecondition(db, reportId, reason) {
    await expect(rejectReportCore(db, {
        reportId,
        reason,
        idempotencyKey: crypto.randomUUID(),
        actor: daetMunicipalAdminActor(),
        now: Timestamp.now(),
    })).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
}
async function seedMercedesAwaitingVerifyReport(db) {
    const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
        municipalityId: 'mercedes',
    });
    return reportId;
}
async function expectModerationIncident(db, reportId) {
    const incident = await readOnlyModerationIncident(db, reportId);
    expect(incident).toMatchObject({
        reportId,
        reason: 'obviously_false',
        notes: 'duplicate from known troll',
        actor: 'admin-1',
    });
}
async function readOnlyModerationIncident(db, reportId) {
    const incidents = await db
        .collection('moderation_incidents')
        .where('reportId', '==', reportId)
        .get();
    expect(incidents.docs).toHaveLength(1);
    return incidents.docs[0].data();
}
describe('rejectReportCore', () => {
    it('transitions awaiting_verify → cancelled_false_report and writes moderation incident', async ({ skip, }) => {
        await withFirestoreRulesDisabled({
            env: testEnv,
            available,
            skip,
            async run(db, env) {
                const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
                    municipalityId: 'daet',
                });
                await seedDaetMunicipalAdmin(env);
                const result = await rejectReportCore(db, {
                    reportId,
                    reason: 'obviously_false',
                    notes: 'duplicate from known troll',
                    idempotencyKey: crypto.randomUUID(),
                    actor: daetMunicipalAdminActor(),
                    now: Timestamp.now(),
                });
                expect(result.status).toBe('cancelled_false_report');
                const reportSnap = await db.collection('reports').doc(reportId).get();
                const report = reportSnap.data();
                expect(report.status).toBe('cancelled_false_report');
                await expectModerationIncident(db, reportId);
                const events = await db.collection('report_events').where('reportId', '==', reportId).get();
                const eventData = events.docs.map((doc) => doc.data());
                expect(eventData.filter((event) => event.to === 'cancelled_false_report')).toHaveLength(1);
                expect(eventData).toContainEqual(expect.objectContaining({
                    from: 'awaiting_verify',
                    to: 'cancelled_false_report',
                }));
                const notificationEvents = eventData.filter((event) => event.type === 'notification_attempted');
                expect(notificationEvents).toHaveLength(1);
                expect(notificationEvents[0]).toMatchObject({
                    reportId,
                    channel: 'push',
                    audience: 'citizen',
                    fcmResult: 'no_token',
                    fcmWarnings: ['fcm_no_token'],
                    schemaVersion: 1,
                });
            },
        });
    });
    it('rejects non-awaiting_verify states with FAILED_PRECONDITION', async ({ skip }) => {
        await withFirestoreRulesDisabled({
            env: testEnv,
            available,
            skip,
            async run(db, env) {
                const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' });
                await seedDaetMunicipalAdmin(env);
                await expectMunicipalRejectFailedPrecondition(db, reportId, 'obviously_false');
            },
        });
    });
    it('FAILED_PRECONDITION when report is already verified', async ({ skip }) => {
        await withFirestoreRulesDisabled({
            env: testEnv,
            available,
            skip,
            async run(db, env) {
                const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' });
                await seedDaetMunicipalAdmin(env);
                await expectMunicipalRejectFailedPrecondition(db, reportId, 'insufficient_detail');
            },
        });
    });
    it('rejects cross-muni with FORBIDDEN', async ({ skip }) => {
        await withFirestoreRulesDisabled({
            env: testEnv,
            available,
            skip,
            async run(db, env) {
                const reportId = await seedMercedesAwaitingVerifyReport(db);
                await seedActiveAccount(env, {
                    uid: 'admin-1',
                    role: 'municipal_admin',
                    municipalityId: 'daet',
                });
                await expect(rejectReportCore(db, {
                    reportId,
                    reason: 'obviously_false',
                    idempotencyKey: crypto.randomUUID(),
                    actor: {
                        uid: 'admin-1',
                        claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
                    },
                    now: Timestamp.now(),
                })).rejects.toMatchObject({ code: 'FORBIDDEN' });
            },
        });
    });
    it('allows provincial_superadmin to reject report in any municipality', async ({ skip }) => {
        await withFirestoreRulesDisabled({
            env: testEnv,
            available,
            skip,
            async run(db, env) {
                const reportId = await seedMercedesAwaitingVerifyReport(db);
                await seedActiveAccount(env, {
                    uid: 'super-1',
                    role: 'provincial_superadmin',
                });
                const result = await rejectReportCore(db, {
                    reportId,
                    reason: 'obviously_false',
                    idempotencyKey: crypto.randomUUID(),
                    actor: {
                        uid: 'super-1',
                        claims: staffClaims({ role: 'provincial_superadmin' }),
                    },
                    now: Timestamp.now(),
                });
                expect(result.status).toBe('cancelled_false_report');
                const reportSnap = await db.collection('reports').doc(reportId).get();
                const report = reportSnap.data();
                expect(report.status).toBe('cancelled_false_report');
            },
        });
    });
});
//# sourceMappingURL=reject-report.test.js.map