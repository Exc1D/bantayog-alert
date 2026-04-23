import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, initializeTestEnvironment, } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules');
let testEnv;
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: `phase-4a-mw-rules-${String(Date.now())}`,
        firestore: { rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8') },
    });
});
afterAll(async () => {
    await testEnv.cleanup();
});
beforeEach(async () => {
    await testEnv.clearFirestore();
});
describe('sms_provider_health/{id}/minute_windows rules', () => {
    it('denies all client reads and writes', async () => {
        const ctx = testEnv.authenticatedContext('a1', { role: 'municipal_admin', active: true });
        await assertFails(ctx
            .firestore()
            .collection('sms_provider_health')
            .doc('semaphore')
            .collection('minute_windows')
            .doc('202604191234')
            .get());
        await assertFails(ctx
            .firestore()
            .collection('sms_provider_health')
            .doc('semaphore')
            .collection('minute_windows')
            .doc('202604191234')
            .set({ attempts: 1 }));
    });
    it('denies superadmin reads and writes', async () => {
        const ctx = testEnv.authenticatedContext('s1', { role: 'provincial_superadmin', active: true });
        await assertFails(ctx
            .firestore()
            .collection('sms_provider_health')
            .doc('semaphore')
            .collection('minute_windows')
            .doc('202604191234')
            .get());
        await assertFails(ctx
            .firestore()
            .collection('sms_provider_health')
            .doc('semaphore')
            .collection('minute_windows')
            .doc('202604191234')
            .set({ attempts: 1 }));
    });
    it('denies unauthenticated reads and writes', async () => {
        const ctx = testEnv.unauthenticatedContext();
        await assertFails(ctx
            .firestore()
            .collection('sms_provider_health')
            .doc('semaphore')
            .collection('minute_windows')
            .doc('202604191234')
            .get());
        await assertFails(ctx
            .firestore()
            .collection('sms_provider_health')
            .doc('semaphore')
            .collection('minute_windows')
            .doc('202604191234')
            .set({ attempts: 1 }));
    });
});
//# sourceMappingURL=sms-minute-windows.rules.test.js.map