import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { setDoc, doc } from 'firebase/firestore';
import {} from 'firebase-admin/firestore';
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }));
let adminDb;
vi.mock('../../admin-init.js', () => ({
    get adminDb() {
        return adminDb;
    },
}));
import { duplicateClusterTriggerCore } from '../../triggers/duplicate-cluster-trigger.js';
const ts = 1713350400000;
let testEnv;
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'dup-cluster-test',
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
const DAET_GEOHASH = 'w7hfm2mb';
const NEARBY_GEOHASH = 'w7hfm2mc';
async function seedReportOps(id, overrides) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'report_ops', id), {
            municipalityId: 'daet',
            reportType: 'flood',
            status: 'new',
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            locationGeohash: DAET_GEOHASH,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
            ...overrides,
        });
    });
}
function makeSnap(id, data) {
    return {
        id,
        ref: adminDb.collection('report_ops').doc(id),
        data: () => data,
    };
}
describe('duplicateClusterTrigger', () => {
    it('does not set duplicateClusterId when no nearby reports exist', async () => {
        const newData = {
            municipalityId: 'daet',
            reportType: 'flood',
            status: 'new',
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            locationGeohash: DAET_GEOHASH,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
        };
        const snap = makeSnap('r-new', newData);
        await duplicateClusterTriggerCore(adminDb, snap);
        const updated = await adminDb.collection('report_ops').doc('r-new').get();
        expect(updated.data()?.duplicateClusterId).toBeUndefined();
    });
    it('sets duplicateClusterId on both reports when same type + muni + within geohash proximity + within 2h', async () => {
        await seedReportOps('r-existing', { locationGeohash: NEARBY_GEOHASH, createdAt: ts - 3600000 });
        const newData = {
            municipalityId: 'daet',
            reportType: 'flood',
            status: 'new',
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            locationGeohash: DAET_GEOHASH,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
        };
        await seedReportOps('r-new', { locationGeohash: DAET_GEOHASH });
        const snap = makeSnap('r-new', newData);
        await duplicateClusterTriggerCore(adminDb, snap);
        const newSnap = await adminDb.collection('report_ops').doc('r-new').get();
        const existingSnap = await adminDb.collection('report_ops').doc('r-existing').get();
        expect(newSnap.data()?.duplicateClusterId).toBeDefined();
        expect(newSnap.data()?.duplicateClusterId).toBe(existingSnap.data()?.duplicateClusterId);
    });
    it('does not cluster reports of different types', async () => {
        await seedReportOps('r-fire', {
            reportType: 'fire',
            locationGeohash: NEARBY_GEOHASH,
            createdAt: ts - 60000,
        });
        const newData = {
            municipalityId: 'daet',
            reportType: 'flood',
            status: 'new',
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            locationGeohash: DAET_GEOHASH,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
        };
        const snap = makeSnap('r-new', newData);
        await duplicateClusterTriggerCore(adminDb, snap);
        const updated = await adminDb.collection('report_ops').doc('r-new').get();
        expect(updated.data()?.duplicateClusterId).toBeUndefined();
    });
    it('does not cluster reports older than 2h', async () => {
        const TWO_H_PLUS_ONE = 2 * 3600000 + 1;
        await seedReportOps('r-old', {
            locationGeohash: NEARBY_GEOHASH,
            createdAt: ts - TWO_H_PLUS_ONE,
        });
        const newData = {
            municipalityId: 'daet',
            reportType: 'flood',
            status: 'new',
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            locationGeohash: DAET_GEOHASH,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
        };
        const snap = makeSnap('r-new', newData);
        await duplicateClusterTriggerCore(adminDb, snap);
        const updated = await adminDb.collection('report_ops').doc('r-new').get();
        expect(updated.data()?.duplicateClusterId).toBeUndefined();
    });
    it('assigns the same existing clusterId when a third report joins a cluster', async () => {
        const existingClusterId = 'cluster-uuid-existing';
        await seedReportOps('r-first', {
            locationGeohash: NEARBY_GEOHASH,
            createdAt: ts - 3600000,
            duplicateClusterId: existingClusterId,
        });
        const newData = {
            municipalityId: 'daet',
            reportType: 'flood',
            status: 'new',
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            locationGeohash: DAET_GEOHASH,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
        };
        await seedReportOps('r-third', { locationGeohash: DAET_GEOHASH });
        const snap = makeSnap('r-third', newData);
        await duplicateClusterTriggerCore(adminDb, snap);
        const updated = await adminDb.collection('report_ops').doc('r-third').get();
        expect(updated.data()?.duplicateClusterId).toBe(existingClusterId);
    });
    it('skips reports with no locationGeohash', async () => {
        const newData = {
            municipalityId: 'daet',
            reportType: 'flood',
            status: 'new',
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
        };
        const snap = makeSnap('r-noloc', newData);
        await duplicateClusterTriggerCore(adminDb, snap);
        const updated = await adminDb.collection('report_ops').doc('r-noloc').get();
        expect(updated.data()?.duplicateClusterId).toBeUndefined();
    });
    it('is safe to run twice (idempotent cluster assignment)', async () => {
        await seedReportOps('r-existing', { locationGeohash: NEARBY_GEOHASH, createdAt: ts - 3600000 });
        const newData = {
            municipalityId: 'daet',
            reportType: 'flood',
            status: 'new',
            severity: 'high',
            createdAt: ts,
            updatedAt: ts,
            agencyIds: [],
            activeResponderCount: 0,
            requiresLocationFollowUp: false,
            locationGeohash: DAET_GEOHASH,
            visibility: { scope: 'municipality', sharedWith: [] },
            schemaVersion: 1,
        };
        const snap = makeSnap('r-new', newData);
        await seedReportOps('r-new', { locationGeohash: DAET_GEOHASH });
        await duplicateClusterTriggerCore(adminDb, snap);
        const firstRunSnap = await adminDb.collection('report_ops').doc('r-new').get();
        const firstClusterId = firstRunSnap.data()?.duplicateClusterId;
        const snap2 = makeSnap('r-new', { ...newData, duplicateClusterId: firstClusterId });
        await duplicateClusterTriggerCore(adminDb, snap2);
        const secondRunSnap = await adminDb.collection('report_ops').doc('r-new').get();
        expect(secondRunSnap.data()?.duplicateClusterId).toBe(firstClusterId);
    });
});
//# sourceMappingURL=duplicate-cluster.test.js.map