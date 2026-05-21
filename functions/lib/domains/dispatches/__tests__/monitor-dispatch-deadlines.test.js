import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {} from '@firebase/rules-unit-testing';
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
const itif = (condition) => (condition ? it : it.skip);
import { setDoc, doc } from 'firebase/firestore';
import {} from 'firebase-admin/firestore';
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }));
let adminDb;
vi.mock('../../../admin-init.js', () => ({
    get adminDb() {
        return adminDb;
    },
}));
import { monitorDispatchDeadlinesCore } from '../monitor-dispatch-deadlines.js';
const ts = 1713350400000;
let testEnv;
let available = false;
beforeAll(async () => {
    const guarded = await guardInitTestEnvironment({
        projectId: 'dispatch-monitor-test',
        firestore: {
            host: 'localhost',
            port: 8081,
            rules: 'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
        },
    }, 'monitor-dispatch-deadlines');
    testEnv = guarded.env;
    available = guarded.available;
    if (!available)
        return;
    adminDb = testEnv.unauthenticatedContext().firestore();
});
beforeEach(async () => {
    if (!available || !testEnv)
        return;
    await testEnv.clearFirestore();
});
afterAll(async () => {
    await testEnv?.cleanup();
});
describe('monitorDispatchDeadlines — deadline exceeded', () => {
    itif(available)('escalates pending dispatch past deadline with expired lease', async () => {
        // Create a dispatch past deadline with expired lease
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
                status: 'pending',
                reportId: 'r1',
                assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                acknowledgementDeadlineAt: ts - 60000, // 1 min past deadline
                monitorLeaseAt: ts - 180000, // lease expired 3 min ago
                escalationCount: 0,
                previouslyNotifiedResponderUids: [],
                createdAt: ts - 300000,
            });
        });
        // Create an available responder in same municipality
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'responders', 'responder-2'), {
                availabilityStatus: 'available',
                accountStatus: 'active',
                agencyId: 'bfp',
                municipalityId: 'daet',
                lastSeenAt: ts - 60000,
                fcmTokens: ['token-2'],
            });
        });
        await monitorDispatchDeadlinesCore(adminDb, {
            now: ts,
            config: {
                autoEscalationEnabled: true,
                maxDispatchesPerRun: 50,
                maxEscalationsPerRun: 50,
                enableCircuitBreaker: false,
                circuitBreakerThreshold: 100,
                circuitBreakerErrorThreshold: 10,
                updatedAt: 0,
                updatedBy: 'system',
            },
        });
        const d1 = await adminDb.collection('dispatches').doc('d1').get();
        const data = d1.data();
        expect(data.status).toBe('pending');
        expect(data.escalationCount).toBe(1);
        expect(data.assignedTo.uid).toBe('responder-2');
        expect(data.previouslyNotifiedResponderUids).toContain('responder-1');
        // Events
        const events = await adminDb.collection('dispatch_events').get();
        expect(events.size).toBe(2); // deadline_exceeded + escalation_attempted
        const deadlineEvent = events.docs.find((d) => d.data().type === 'deadline_exceeded');
        expect(deadlineEvent?.data().escalationCount).toBe(1);
        const escalationEvent = events.docs.find((d) => d.data().type === 'escalation_attempted');
        expect(escalationEvent?.data().fromResponderUid).toBe('responder-1');
        expect(escalationEvent?.data().toResponderUid).toBe('responder-2');
    });
    itif(available)('flips to needs_admin when escalation cap reached', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
                status: 'pending',
                reportId: 'r1',
                assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                acknowledgementDeadlineAt: ts - 60000,
                monitorLeaseAt: ts - 180000,
                escalationCount: 1,
                previouslyNotifiedResponderUids: ['responder-1'],
                createdAt: ts - 300000,
            });
        });
        await monitorDispatchDeadlinesCore(adminDb, {
            now: ts,
            config: {
                autoEscalationEnabled: true,
                maxDispatchesPerRun: 50,
                maxEscalationsPerRun: 50,
                enableCircuitBreaker: false,
                circuitBreakerThreshold: 100,
                circuitBreakerErrorThreshold: 10,
                updatedAt: 0,
                updatedBy: 'system',
            },
        });
        const d1 = await adminDb.collection('dispatches').doc('d1').get();
        const data = d1.data();
        expect(data.status).toBe('needs_admin');
        const events = await adminDb.collection('dispatch_events').get();
        expect(events.size).toBe(1);
        expect(events.docs[0].data().type).toBe('deadline_exceeded');
    });
    itif(available)('flips to needs_admin when no available responders', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
                status: 'pending',
                reportId: 'r1',
                assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                acknowledgementDeadlineAt: ts - 60000,
                monitorLeaseAt: ts - 180000,
                escalationCount: 0,
                previouslyNotifiedResponderUids: [],
                createdAt: ts - 300000,
            });
        });
        // No responders in DB — should flip to needs_admin
        await monitorDispatchDeadlinesCore(adminDb, {
            now: ts,
            config: {
                autoEscalationEnabled: true,
                maxDispatchesPerRun: 50,
                maxEscalationsPerRun: 50,
                enableCircuitBreaker: false,
                circuitBreakerThreshold: 100,
                circuitBreakerErrorThreshold: 10,
                updatedAt: 0,
                updatedBy: 'system',
            },
        });
        const d1 = await adminDb.collection('dispatches').doc('d1').get();
        expect(d1.data()?.status).toBe('needs_admin');
    });
    itif(available)('skips dispatches with unexpired lease', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
                status: 'pending',
                reportId: 'r1',
                assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
                municipalityId: 'daet',
                acknowledgementDeadlineAt: ts - 60000,
                monitorLeaseAt: ts, // lease NOT expired (within 2 min)
                escalationCount: 0,
                previouslyNotifiedResponderUids: [],
                createdAt: ts - 300000,
            });
        });
        await monitorDispatchDeadlinesCore(adminDb, {
            now: ts,
            config: {
                autoEscalationEnabled: true,
                maxDispatchesPerRun: 50,
                maxEscalationsPerRun: 50,
                enableCircuitBreaker: false,
                circuitBreakerThreshold: 100,
                circuitBreakerErrorThreshold: 10,
                updatedAt: 0,
                updatedBy: 'system',
            },
        });
        const d1 = await adminDb.collection('dispatches').doc('d1').get();
        expect(d1.data()?.status).toBe('pending'); // unchanged
        expect(d1.data()?.escalationCount).toBe(0);
    });
});
//# sourceMappingURL=monitor-dispatch-deadlines.test.js.map