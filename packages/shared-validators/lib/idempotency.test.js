import { describe, it, expect, vi } from 'vitest';
import { canonicalPayloadHash } from './idempotency.js';
describe('canonicalPayloadHash', () => {
    it('produces a 64-char hex SHA-256 digest', async () => {
        const hash = await canonicalPayloadHash({ a: 1 });
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
    it('returns the same hash for the same input', async () => {
        const a = await canonicalPayloadHash({ reportId: 'r1', source: 'web' });
        const b = await canonicalPayloadHash({ reportId: 'r1', source: 'web' });
        expect(a).toBe(b);
    });
    it('is invariant under key order', async () => {
        const a = await canonicalPayloadHash({ x: 1, y: 2, z: 3 });
        const b = await canonicalPayloadHash({ z: 3, y: 2, x: 1 });
        const c = await canonicalPayloadHash({ y: 2, x: 1, z: 3 });
        expect(a).toBe(b);
        expect(b).toBe(c);
    });
    it('sorts keys at every nesting level', async () => {
        const a = await canonicalPayloadHash({ outer: { b: 2, a: 1 } });
        const b = await canonicalPayloadHash({ outer: { a: 1, b: 2 } });
        expect(a).toBe(b);
    });
    it('produces different hashes for different values', async () => {
        const a = await canonicalPayloadHash({ v: 1 });
        const b = await canonicalPayloadHash({ v: 2 });
        expect(a).not.toBe(b);
    });
    it('handles arrays without sorting their elements (order matters)', async () => {
        const a = await canonicalPayloadHash({ list: [1, 2, 3] });
        const b = await canonicalPayloadHash({ list: [3, 2, 1] });
        expect(a).not.toBe(b);
    });
    it('handles nested structures with arrays and objects', async () => {
        const payload = {
            reportId: 'r1',
            location: { lat: 14.1, lng: 122.9 },
            tags: ['flood', 'urgent'],
        };
        const hash = await canonicalPayloadHash(payload);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
    it('rejects undefined values in payloads', async () => {
        await expect(canonicalPayloadHash({ v: undefined })).rejects.toThrow(TypeError);
        await expect(canonicalPayloadHash({ a: 1, b: undefined })).rejects.toThrow(TypeError);
    });
    it('throws TypeError for Map, Set, and RegExp', async () => {
        for (const exotic of [new Map(), new Set(), /pattern/]) {
            await expect(canonicalPayloadHash({ data: exotic })).rejects.toThrow(TypeError);
        }
    });
    it('throws Error if Web Crypto API is not available', async () => {
        vi.stubGlobal('crypto', undefined);
        try {
            await expect(canonicalPayloadHash({ a: 1 })).rejects.toThrow('Web Crypto API (globalThis.crypto.subtle) is not available');
        }
        finally {
            vi.unstubAllGlobals();
        }
    });
});
//# sourceMappingURL=idempotency.test.js.map