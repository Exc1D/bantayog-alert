import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { setDoc, doc } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }));
const { onCallMock } = vi.hoisted(() => ({
    onCallMock: vi.fn((_config, handler) => handler),
}));
vi.mock('firebase-functions/v2/https', async () => {
    const actual = await vi.importActual('firebase-functions/v2/https');
    return { ...actual, onCall: onCallMock };
});
let adminDb;
vi.mock('../../admin-init.js', () => ({
    get adminDb() {
        return adminDb;
    },
}));
import { requestAgencyAssistanceCore, acceptAgencyAssistanceCore, declineAgencyAssistanceCore, } from '../../callables/request-agency-assistance.js';
import { seedActiveAccount } from '../helpers/seed-factories.js';
const ts = 1713350400000;
let testEnv;
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'agency-assistance-test',
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
const muniAdminActor = {
    uid: 'daet-admin',
    claims: { role: 'municipal_admin', accountStatus: 'active', municipalityId: 'daet' },
};
const agencyAdminActor = {
    uid: 'bfp-admin',
    claims: { role: 'agency_admin', accountStatus: 'active', agencyId: 'bfp' },
};
async function seedReport(id, status = 'verified', muni = 'daet') {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'report_ops', id), {
            reportId: id,
            status,
            municipalityId: muni,
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
        });
    });
}
describe('requestAgencyAssistance', () => {
    it('rejects a non-muni-admin caller', async () => {
        await seedReport('r1');
        await expect(requestAgencyAssistanceCore(adminDb, {
            reportId: 'r1',
            agencyId: 'bfp',
            actor: {
                uid: 'resp-1',
                claims: { role: 'responder', municipalityId: 'daet' },
            },
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    it('rejects a muni admin requesting for a report in another municipality', async () => {
        await seedReport('r1', 'verified', 'mercedes');
        await expect(requestAgencyAssistanceCore(adminDb, {
            reportId: 'r1',
            agencyId: 'bfp',
            actor: muniAdminActor,
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    it('rejects a request for a terminal-status report', async () => {
        await seedReport('r1', 'closed');
        await expect(requestAgencyAssistanceCore(adminDb, {
            reportId: 'r1',
            agencyId: 'bfp',
            actor: muniAdminActor,
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        })).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
    });
    it('creates agency_assistance_requests doc with status pending', async () => {
        await seedReport('r1');
        await seedActiveAccount(testEnv, { uid: 'bfp-admin', role: 'agency_admin', agencyId: 'bfp' });
        const result = await requestAgencyAssistanceCore(adminDb, {
            reportId: 'r1',
            agencyId: 'bfp',
            actor: muniAdminActor,
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        });
        expect(result.status).toBe('created');
        const snap = await adminDb.collection('agency_assistance_requests').doc(result.requestId).get();
        expect(snap.data()?.status).toBe('pending');
    });
    it('creates a command_channel_thread with threadType agency_assistance', async () => {
        await seedReport('r1');
        await seedActiveAccount(testEnv, { uid: 'bfp-admin', role: 'agency_admin', agencyId: 'bfp' });
        const result = await requestAgencyAssistanceCore(adminDb, {
            reportId: 'r1',
            agencyId: 'bfp',
            actor: muniAdminActor,
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        });
        const threads = await adminDb
            .collection('command_channel_threads')
            .where('assistanceRequestId', '==', result.requestId)
            .get();
        expect(threads.empty).toBe(false);
        expect(threads.docs[0]?.data().threadType).toBe('agency_assistance');
    });
    it('is idempotent — double-call returns success without duplicate docs', async () => {
        await seedReport('r1');
        await seedActiveAccount(testEnv, { uid: 'bfp-admin', role: 'agency_admin', agencyId: 'bfp' });
        const key = crypto.randomUUID();
        const r1 = await requestAgencyAssistanceCore(adminDb, {
            reportId: 'r1',
            agencyId: 'bfp',
            actor: muniAdminActor,
            idempotencyKey: key,
            now: Timestamp.fromMillis(ts),
        });
        const r2 = await requestAgencyAssistanceCore(adminDb, {
            reportId: 'r1',
            agencyId: 'bfp',
            actor: muniAdminActor,
            idempotencyKey: key,
            now: Timestamp.fromMillis(ts),
        });
        expect(r1.requestId).toBe(r2.requestId);
        const snap = await adminDb.collection('agency_assistance_requests').get();
        expect(snap.docs.length).toBe(1);
    });
});
describe('acceptAgencyAssistance', () => {
    it('rejects a caller whose agencyId does not match the request', async () => {
        await seedReport('r1');
        const reqRef = adminDb.collection('agency_assistance_requests').doc('ar1');
        await reqRef.set({
            reportId: 'r1',
            requestedByMunicipalId: 'daet',
            requestedByMunicipality: 'Daet',
            targetAgencyId: 'bfp',
            requestType: 'BFP',
            message: '',
            priority: 'normal',
            status: 'pending',
            fulfilledByDispatchIds: [],
            createdAt: ts,
            expiresAt: ts + 3600000,
            schemaVersion: 1,
        });
        await expect(acceptAgencyAssistanceCore(adminDb, {
            requestId: 'ar1',
            actor: {
                uid: 'pnp-admin',
                claims: { role: 'agency_admin', accountStatus: 'active', agencyId: 'pnp' },
            },
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    it('updates status to accepted', async () => {
        await seedReport('r1');
        const reqRef = adminDb.collection('agency_assistance_requests').doc('ar1');
        await reqRef.set({
            reportId: 'r1',
            requestedByMunicipalId: 'daet',
            requestedByMunicipality: 'Daet',
            targetAgencyId: 'bfp',
            requestType: 'BFP',
            message: '',
            priority: 'normal',
            status: 'pending',
            fulfilledByDispatchIds: [],
            createdAt: ts,
            expiresAt: ts + 3600000,
            schemaVersion: 1,
        });
        await acceptAgencyAssistanceCore(adminDb, {
            requestId: 'ar1',
            actor: agencyAdminActor,
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        });
        const snap = await reqRef.get();
        expect(snap.data()?.status).toBe('accepted');
        expect(snap.data()?.respondedBy).toBe('bfp-admin');
    });
});
describe('declineAgencyAssistance', () => {
    it('requires a non-empty reason', async () => {
        const reqRef = adminDb.collection('agency_assistance_requests').doc('ar1');
        await reqRef.set({
            reportId: 'r1',
            requestedByMunicipalId: 'daet',
            requestedByMunicipality: 'Daet',
            targetAgencyId: 'bfp',
            requestType: 'BFP',
            message: '',
            priority: 'normal',
            status: 'pending',
            fulfilledByDispatchIds: [],
            createdAt: ts,
            expiresAt: ts + 3600000,
            schemaVersion: 1,
        });
        await expect(declineAgencyAssistanceCore(adminDb, {
            requestId: 'ar1',
            reason: '   ',
            actor: agencyAdminActor,
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    });
    it('updates status to declined with reason and closes thread', async () => {
        const reqRef = adminDb.collection('agency_assistance_requests').doc('ar1');
        await reqRef.set({
            reportId: 'r1',
            requestedByMunicipalId: 'daet',
            requestedByMunicipality: 'Daet',
            targetAgencyId: 'bfp',
            requestType: 'BFP',
            message: '',
            priority: 'normal',
            status: 'pending',
            fulfilledByDispatchIds: [],
            createdAt: ts,
            expiresAt: ts + 3600000,
            schemaVersion: 1,
        });
        const threadRef = adminDb.collection('command_channel_threads').doc('th1');
        await threadRef.set({
            threadId: 'th1',
            reportId: 'r1',
            assistanceRequestId: 'ar1',
            threadType: 'agency_assistance',
            subject: 'Need help',
            participantUids: { 'daet-admin': true, 'bfp-admin': true },
            createdBy: 'daet-admin',
            createdAt: ts,
            updatedAt: ts,
            schemaVersion: 1,
        });
        await declineAgencyAssistanceCore(adminDb, {
            requestId: 'ar1',
            reason: 'Units deployed elsewhere',
            actor: agencyAdminActor,
            idempotencyKey: crypto.randomUUID(),
            now: Timestamp.fromMillis(ts),
        });
        const reqSnap = await reqRef.get();
        expect(reqSnap.data()?.status).toBe('declined');
        expect(reqSnap.data()?.declinedReason).toBe('Units deployed elsewhere');
        const threadSnap = await threadRef.get();
        expect(threadSnap.data()?.closedAt).toBe(ts);
    });
});
//# sourceMappingURL=agency-assistance.test.js.map