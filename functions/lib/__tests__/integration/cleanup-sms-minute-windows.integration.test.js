import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cleanupSmsMinuteWindowsCore } from '../../triggers/cleanup-sms-minute-windows.js';
let testEnv;
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: `phase-4a-clean-${Date.now().toString()}`,
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
afterAll(async () => {
    await testEnv.cleanup();
    delete process.env.FIRESTORE_EMULATOR_HOST;
});
describe('cleanupSmsMinuteWindowsCore', () => {
    it('deletes windows older than 1h, retains newer ones, paginates over 500-doc batches', async () => {
        const db = getFirestore();
        const now = Date.now();
        // 600 old (older than 1h), 50 recent
        let batch = db.batch();
        for (let i = 0; i < 600; i++) {
            const startMs = now - 2 * 60 * 60 * 1000 - i * 60_000;
            const id = String(20_000_000_000_0000 + i);
            batch.set(db.collection('sms_provider_health').doc('semaphore').collection('minute_windows').doc(id), {
                providerId: 'semaphore',
                windowStartMs: startMs,
                attempts: 1,
                failures: 0,
                rateLimitedCount: 0,
                latencySumMs: 0,
                maxLatencyMs: 0,
                updatedAt: startMs,
                schemaVersion: 1,
            });
            if ((i + 1) % 400 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        await batch.commit();
        const recentBatch = db.batch();
        for (let i = 0; i < 50; i++) {
            const startMs = now - i * 60_000;
            const id = `recent-${i.toString()}`;
            recentBatch.set(db.collection('sms_provider_health').doc('semaphore').collection('minute_windows').doc(id), {
                providerId: 'semaphore',
                windowStartMs: startMs,
                attempts: 1,
                failures: 0,
                rateLimitedCount: 0,
                latencySumMs: 0,
                maxLatencyMs: 0,
                updatedAt: startMs,
                schemaVersion: 1,
            });
        }
        await recentBatch.commit();
        await cleanupSmsMinuteWindowsCore({ db, now: () => now });
        const remaining = await db
            .collection('sms_provider_health')
            .doc('semaphore')
            .collection('minute_windows')
            .get();
        expect(remaining.size).toBe(50);
    }, 30_000);
});
//# sourceMappingURL=cleanup-sms-minute-windows.integration.test.js.map