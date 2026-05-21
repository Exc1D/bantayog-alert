import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {} from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase-admin/firestore';
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
import { checkRateLimit } from '../rate-limit.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const RULES_PATH = resolve(import.meta.dirname, '../../../../../infra/firebase/firestore.rules');
const guarded = await guardInitTestEnvironment({
    projectId: 'rate-limit-test',
    firestore: {
        host: 'localhost',
        port: 8081,
        rules: readFileSync(RULES_PATH, 'utf8'),
    },
}, 'rate-limit');
const testEnv = guarded.env;
const available = guarded.available;
const itif = (condition) => (condition ? it : it.skip);
beforeEach(async () => {
    if (!testEnv)
        return;
    await testEnv.clearFirestore();
});
afterAll(async () => {
    await testEnv?.cleanup();
});
describe('checkRateLimit', () => {
    itif(available)('allows the first call under the limit', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = ctx.firestore();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const result = await checkRateLimit(db, {
                key: 'verifyReport:uid-1',
                limit: 60,
                windowSeconds: 60,
                now: Timestamp.now(),
                updatedAt: Date.now(),
            });
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(59);
        });
    });
    itif(available)('denies calls past the limit and returns retryAfterSeconds', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = ctx.firestore();
            const now = Timestamp.now();
            const nowMs = now.toMillis();
            for (let i = 0; i < 60; i++) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                await checkRateLimit(db, {
                    key: 'verifyReport:uid-1',
                    limit: 60,
                    windowSeconds: 60,
                    now,
                    updatedAt: nowMs,
                });
            }
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const denied = await checkRateLimit(db, {
                key: 'verifyReport:uid-1',
                limit: 60,
                windowSeconds: 60,
                now,
                updatedAt: nowMs,
            });
            expect(denied.allowed).toBe(false);
            expect(denied.retryAfterSeconds).toBeGreaterThan(0);
        });
    });
    itif(available)('evicts timestamps outside the window', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = ctx.firestore();
            const now = Timestamp.fromMillis(1_000_000);
            const old = Timestamp.fromMillis(900_000); // 100 s before window start (window = 60 s)
            // Seed an old timestamp outside the 60s window
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            await checkRateLimit(db, {
                key: 'evict-test',
                limit: 60,
                windowSeconds: 60,
                now: old,
                updatedAt: old.toMillis(),
            });
            // Now call with current time — old entry must be filtered out
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const result = await checkRateLimit(db, {
                key: 'evict-test',
                limit: 60,
                windowSeconds: 60,
                now,
                updatedAt: now.toMillis(),
            });
            expect(result.allowed).toBe(true);
        });
    });
});
//# sourceMappingURL=rate-limit.test.js.map