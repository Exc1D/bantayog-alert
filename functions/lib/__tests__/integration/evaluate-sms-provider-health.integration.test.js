import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { evaluateSmsProviderHealthCore } from '../../triggers/evaluate-sms-provider-health.js';
let testEnv;
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: `phase-4a-health-${Date.now().toString()}`,
        firestore: {
            rules: 'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}',
        },
    });
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    if (getApps().length === 0)
        initializeApp({ projectId: testEnv.projectId });
});
afterEach(async () => {
    await testEnv.clearFirestore();
});
async function seedMinuteWindow(providerId, windowId, data) {
    await getFirestore()
        .collection('sms_provider_health')
        .doc(providerId)
        .collection('minute_windows')
        .doc(windowId)
        .set({ ...data, providerId, schemaVersion: 1 });
}
describe('evaluateSmsProviderHealthCore', () => {
    it('opens circuit when error rate > 30% over 5 windows with attempts >= 10', async () => {
        const now = 1_700_000_300_000; // 5 minutes past epoch bucket
        for (let i = 0; i < 5; i++) {
            const windowId = `win-${i.toString()}`;
            await seedMinuteWindow('semaphore', windowId, {
                windowStartMs: now - (5 - i) * 60_000,
                attempts: 5,
                failures: 3,
                rateLimitedCount: 0,
                latencySumMs: 1000,
                maxLatencyMs: 500,
                updatedAt: now,
            });
        }
        await evaluateSmsProviderHealthCore({ db: getFirestore(), now: () => now });
        const snap = await getFirestore().collection('sms_provider_health').doc('semaphore').get();
        expect(snap.data()?.circuitState).toBe('open');
        expect(snap.data()?.lastTransitionReason).toMatch(/error rate/i);
    });
    it('opens circuit on latency spike > 30s', async () => {
        const now = 1_700_000_300_000;
        for (let i = 0; i < 5; i++) {
            const windowId = `lat-${i.toString()}`;
            await seedMinuteWindow('semaphore', windowId, {
                windowStartMs: now - (5 - i) * 60_000,
                attempts: 15,
                failures: 1,
                rateLimitedCount: 0,
                latencySumMs: 1000,
                maxLatencyMs: i === 2 ? 35_000 : 200,
                updatedAt: now,
            });
        }
        await evaluateSmsProviderHealthCore({ db: getFirestore(), now: () => now });
        const snap = await getFirestore().collection('sms_provider_health').doc('semaphore').get();
        expect(snap.data()?.circuitState).toBe('open');
        expect(snap.data()?.lastTransitionReason).toMatch(/latency/i);
    });
    it('transitions open → half_open after 5m cooldown', async () => {
        const now = 1_700_000_900_000;
        await getFirestore()
            .collection('sms_provider_health')
            .doc('semaphore')
            .set({
            providerId: 'semaphore',
            circuitState: 'open',
            errorRatePct: 50,
            openedAt: now - 6 * 60_000,
            updatedAt: now - 6 * 60_000,
        });
        await evaluateSmsProviderHealthCore({ db: getFirestore(), now: () => now });
        const snap = await getFirestore().collection('sms_provider_health').doc('semaphore').get();
        expect(snap.data()?.circuitState).toBe('half_open');
    });
    it('half_open → closed on probe success (latest window all success)', async () => {
        const now = 1_700_001_500_000;
        await getFirestore().collection('sms_provider_health').doc('semaphore').set({
            providerId: 'semaphore',
            circuitState: 'half_open',
            errorRatePct: 0,
            updatedAt: now,
        });
        await seedMinuteWindow('semaphore', 'probe', {
            windowStartMs: now - 60_000,
            attempts: 3,
            failures: 0,
            rateLimitedCount: 0,
            latencySumMs: 300,
            maxLatencyMs: 200,
            updatedAt: now,
        });
        await evaluateSmsProviderHealthCore({ db: getFirestore(), now: () => now });
        const snap = await getFirestore().collection('sms_provider_health').doc('semaphore').get();
        expect(snap.data()?.circuitState).toBe('closed');
    });
    it('half_open → open on probe failure', async () => {
        const now = 1_700_001_500_000;
        await getFirestore().collection('sms_provider_health').doc('semaphore').set({
            providerId: 'semaphore',
            circuitState: 'half_open',
            errorRatePct: 0,
            updatedAt: now,
        });
        await seedMinuteWindow('semaphore', 'fail-probe', {
            windowStartMs: now - 60_000,
            attempts: 2,
            failures: 2,
            rateLimitedCount: 0,
            latencySumMs: 300,
            maxLatencyMs: 200,
            updatedAt: now,
        });
        await evaluateSmsProviderHealthCore({ db: getFirestore(), now: () => now });
        const snap = await getFirestore().collection('sms_provider_health').doc('semaphore').get();
        expect(snap.data()?.circuitState).toBe('open');
    });
});
//# sourceMappingURL=evaluate-sms-provider-health.integration.test.js.map