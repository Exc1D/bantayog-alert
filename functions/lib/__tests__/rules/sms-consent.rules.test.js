import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, initializeTestEnvironment, } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules');
let testEnv;
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: `phase-4a-sms-consent-rules-${String(Date.now())}`,
        firestore: { rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8') },
    });
});
afterAll(async () => {
    await testEnv.cleanup();
});
beforeEach(async () => {
    await testEnv.clearFirestore();
});
describe('report_sms_consent rules', () => {
    it('denies all client reads', async () => {
        const ctx = testEnv.authenticatedContext('a1', { role: 'municipal_admin', active: true });
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').get());
    });
    it('denies all client writes', async () => {
        const ctx = testEnv.authenticatedContext('a1', { role: 'municipal_admin', active: true });
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').set({
            phone: '+639171234567',
            smsConsent: true,
            locale: 'tl',
        }));
    });
    it('denies citizen reads and writes', async () => {
        const ctx = testEnv.authenticatedContext('u1', { role: 'citizen' });
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').get());
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').set({
            phone: '+639171234567',
            smsConsent: true,
        }));
    });
    it('denies responder reads and writes', async () => {
        const ctx = testEnv.authenticatedContext('r1', { role: 'responder', active: true });
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').get());
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').set({
            phone: '+639171234567',
            smsConsent: true,
        }));
    });
    it('denies provincial_superadmin reads and writes', async () => {
        const ctx = testEnv.authenticatedContext('s1', { role: 'provincial_superadmin', active: true });
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').get());
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').set({
            phone: '+639171234567',
            smsConsent: true,
        }));
    });
    it('denies unauthenticated reads and writes', async () => {
        const ctx = testEnv.unauthenticatedContext();
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').get());
        await assertFails(ctx.firestore().collection('report_sms_consent').doc('r1').set({
            phone: '+639171234567',
            smsConsent: true,
        }));
    });
});
//# sourceMappingURL=sms-consent.rules.test.js.map