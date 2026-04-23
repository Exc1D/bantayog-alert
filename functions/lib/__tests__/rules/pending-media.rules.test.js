import { assertFails } from '@firebase/rules-unit-testing';
import { setDoc, doc, getDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { authed, createTestEnv } from '../helpers/rules-harness.js';
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js';
let env;
beforeAll(async () => {
    env = await createTestEnv('demo-phase-3a-pending-media');
    await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' });
});
afterAll(async () => {
    await env.cleanup();
});
describe('pending_media rules', () => {
    it('rejects citizen writes', async () => {
        const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
        await assertFails(setDoc(doc(db, 'pending_media', 'upl-1'), {
            uploadId: 'upl-1',
            storagePath: 'pending/upl-1',
            strippedAt: ts,
            mimeType: 'image/jpeg',
        }));
    });
    it('rejects citizen reads', async () => {
        const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }));
        await assertFails(getDoc(doc(db, 'pending_media', 'upl-1')));
    });
});
//# sourceMappingURL=pending-media.rules.test.js.map