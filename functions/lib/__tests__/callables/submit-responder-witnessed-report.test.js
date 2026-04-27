import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase-admin/firestore';
vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn(() => ({})),
}));
const { onCallMock } = vi.hoisted(() => ({
    onCallMock: vi.fn((_config, handler) => handler),
}));
vi.mock('firebase-functions/v2/https', async () => {
    const actual = await vi.importActual('firebase-functions/v2/https');
    return {
        ...actual,
        onCall: onCallMock,
    };
});
let adminDb;
vi.mock('../../admin-init.js', () => ({
    get adminDb() {
        return adminDb;
    },
}));
import { submitResponderWitnessedReport, submitResponderWitnessedReportCore, } from '../../callables/submit-responder-witnessed-report.js';
import { seedActiveAccount } from '../helpers/seed-factories.js';
let testEnv;
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'submit-responder-witnessed-report-test',
        firestore: {
            host: 'localhost',
            port: 8081,
            rules: 'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
        },
    });
    adminDb = testEnv.unauthenticatedContext().firestore();
});
beforeEach(async () => {
    await testEnv.clearFirestore();
});
afterAll(async () => {
    await testEnv.cleanup();
});
async function seedDispatchActive({ env, dispatchId, reportId, responderUid, status, }) {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db
            .collection('dispatches')
            .doc(dispatchId)
            .set({
            dispatchId,
            reportId,
            status,
            assignedTo: {
                uid: responderUid,
                agencyId: 'bfp-daet',
                municipalityId: 'daet',
            },
            dispatchedAt: Date.now(),
            lastStatusAt: Date.now(),
            schemaVersion: 1,
        });
    });
}
describe('submitResponderWitnessedReportCore', () => {
    it('creates a responder-witnessed report for an active dispatch', async () => {
        await seedDispatchActive({
            env: testEnv,
            dispatchId: 'dispatch-1',
            reportId: 'report-1',
            responderUid: 'r1',
            status: 'on_scene',
        });
        await seedActiveAccount(testEnv, {
            uid: 'r1',
            role: 'responder',
            municipalityId: 'daet',
        });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const result = await submitResponderWitnessedReportCore(db, {
                dispatchId: 'dispatch-1',
                reportType: 'flood',
                description: 'Water rising fast',
                severity: 'high',
                publicLocation: { lat: 14.1134, lng: 122.9554 },
                idempotencyKey: crypto.randomUUID(),
                actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            });
            expect(result.reportId).toBeDefined();
            expect(result.publicTrackingRef).toBeDefined();
            const report = (await db.collection('reports').doc(result.reportId).get()).data();
            expect(report).toMatchObject({
                source: 'responder_witness',
                witnessPriorityFlag: true,
                reporterRole: 'responder',
                status: 'new',
                reportType: 'flood',
                severity: 'high',
            });
            const ops = (await db.collection('report_ops').doc(result.reportId).get()).data();
            expect(ops?.witnessPriorityFlag).toBe(true);
            const notifications = await db
                .collection('admin_notifications')
                .where('type', '==', 'responder_witness_report')
                .get();
            expect(notifications.docs).toHaveLength(1);
        });
    });
    it('rejects when dispatch is not active', async () => {
        await seedDispatchActive({
            env: testEnv,
            dispatchId: 'dispatch-2',
            reportId: 'report-2',
            responderUid: 'r1',
            status: 'pending',
        });
        await seedActiveAccount(testEnv, {
            uid: 'r1',
            role: 'responder',
            municipalityId: 'daet',
        });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await expect(submitResponderWitnessedReportCore(db, {
                dispatchId: 'dispatch-2',
                reportType: 'flood',
                description: 'Water rising',
                severity: 'high',
                publicLocation: { lat: 14.1134, lng: 122.9554 },
                idempotencyKey: crypto.randomUUID(),
                actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            })).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
        });
    });
    it('is idempotent on same key', async () => {
        await seedDispatchActive({
            env: testEnv,
            dispatchId: 'dispatch-3',
            reportId: 'report-3',
            responderUid: 'r1',
            status: 'en_route',
        });
        await seedActiveAccount(testEnv, {
            uid: 'r1',
            role: 'responder',
            municipalityId: 'daet',
        });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const key = crypto.randomUUID();
            const first = await submitResponderWitnessedReportCore(db, {
                dispatchId: 'dispatch-3',
                reportType: 'fire',
                description: 'Smoke visible',
                severity: 'medium',
                publicLocation: { lat: 14.1134, lng: 122.9554 },
                idempotencyKey: key,
                actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            });
            const second = await submitResponderWitnessedReportCore(db, {
                dispatchId: 'dispatch-3',
                reportType: 'fire',
                description: 'Smoke visible',
                severity: 'medium',
                publicLocation: { lat: 14.1134, lng: 122.9554 },
                idempotencyKey: key,
                actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            });
            expect(second.reportId).toBe(first.reportId);
            const reports = await db
                .collection('reports')
                .where('source', '==', 'responder_witness')
                .get();
            expect(reports.docs).toHaveLength(1);
        });
    });
    it('rejects when caller is not the assigned responder', async () => {
        await seedDispatchActive({
            env: testEnv,
            dispatchId: 'dispatch-4',
            reportId: 'report-4',
            responderUid: 'r1',
            status: 'on_scene',
        });
        await seedActiveAccount(testEnv, {
            uid: 'r2',
            role: 'responder',
            municipalityId: 'daet',
        });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await expect(submitResponderWitnessedReportCore(db, {
                dispatchId: 'dispatch-4',
                reportType: 'flood',
                description: 'Water rising',
                severity: 'high',
                publicLocation: { lat: 14.1134, lng: 122.9554 },
                idempotencyKey: crypto.randomUUID(),
                actor: { uid: 'r2', claims: { role: 'responder', municipalityId: 'daet' } },
                now: Timestamp.now(),
            })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
    });
});
describe('submitResponderWitnessedReport callable', () => {
    const callCallable = submitResponderWitnessedReport;
    it('rejects unauthenticated request', async () => {
        await expect(callCallable({
            data: {
                dispatchId: 'dispatch-x',
                reportType: 'flood',
                description: 'Water rising',
                severity: 'high',
                publicLocation: { lat: 14.1134, lng: 122.9554 },
                idempotencyKey: crypto.randomUUID(),
            },
        })).rejects.toMatchObject({ code: 'unauthenticated' });
    });
    it('rejects wrong-role request', async () => {
        await expect(callCallable({
            auth: {
                uid: 'admin-1',
                token: { role: 'municipal_admin', accountStatus: 'active' },
            },
            data: {
                dispatchId: 'dispatch-x',
                reportType: 'flood',
                description: 'Water rising',
                severity: 'high',
                publicLocation: { lat: 14.1134, lng: 122.9554 },
                idempotencyKey: crypto.randomUUID(),
            },
        })).rejects.toMatchObject({ code: 'permission-denied' });
    });
});
//# sourceMappingURL=submit-responder-witnessed-report.test.js.map