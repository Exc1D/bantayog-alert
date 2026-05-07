import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockFetch = vi.hoisted(() => vi.fn());
vi.mock('firebase-functions/v2/https', () => ({
    onCall: vi.fn((_opts, fn) => fn),
    HttpsError: class HttpsError extends Error {
        code;
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    },
}));
vi.mock('firebase-admin/app', () => ({
    getApp: vi.fn(() => ({
        options: { projectId: 'test-project' },
    })),
}));
import { prewarmSurge } from '../../callables/prewarm-surge.js';
beforeEach(() => {
    mockFetch.mockClear();
    globalThis.fetch = mockFetch;
});
describe('prewarmSurge', () => {
    it('returns count of warmed functions for light level', async () => {
        mockFetch.mockResolvedValue({ status: 200, ok: true });
        const invoke = prewarmSurge;
        const result = await invoke({
            auth: { uid: 'super-1', token: { role: 'provincial_superadmin' } },
            data: { level: 'light' },
        });
        expect(result.warmed).toBe(3);
        expect(mockFetch).toHaveBeenCalledTimes(3);
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('test-project.cloudfunctions.net'), expect.objectContaining({ method: 'GET' }));
    });
    it('returns count of warmed functions for heavy level', async () => {
        mockFetch.mockResolvedValue({ status: 200, ok: true });
        const invoke = prewarmSurge;
        const result = await invoke({
            auth: { uid: 'super-1', token: { role: 'provincial_superadmin' } },
            data: { level: 'heavy' },
        });
        expect(result.warmed).toBe(10);
        expect(mockFetch).toHaveBeenCalledTimes(10);
    });
    it('does not count non-2xx responses', async () => {
        mockFetch.mockResolvedValue({ status: 404, ok: false });
        const invoke = prewarmSurge;
        const result = await invoke({
            auth: { uid: 'super-1', token: { role: 'provincial_superadmin' } },
            data: { level: 'light' },
        });
        expect(result.warmed).toBe(0);
    });
    it('does not count network failures', async () => {
        mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
        const invoke = prewarmSurge;
        const result = await invoke({
            auth: { uid: 'super-1', token: { role: 'provincial_superadmin' } },
            data: { level: 'light' },
        });
        expect(result.warmed).toBe(0);
    });
    it('rejects non-superadmin callers', async () => {
        const invoke = prewarmSurge;
        await expect(invoke({
            auth: { uid: 'muni-1', token: { role: 'municipal_admin' } },
            data: { level: 'light' },
        })).rejects.toMatchObject({ code: 'permission-denied' });
    });
    it('rejects invalid level with invalid-argument', async () => {
        const invoke = prewarmSurge;
        await expect(invoke({
            auth: { uid: 'super-1', token: { role: 'provincial_superadmin' } },
            data: { level: 'invalid' },
        })).rejects.toMatchObject({ code: 'invalid-argument' });
    });
    it('rejects unauthenticated callers', async () => {
        const invoke = prewarmSurge;
        await expect(invoke({
            data: { level: 'light' },
        })).rejects.toMatchObject({ code: 'unauthenticated' });
    });
    it('passes GET with timeout signal', async () => {
        mockFetch.mockResolvedValue({ status: 200, ok: true });
        const invoke = prewarmSurge;
        await invoke({
            auth: { uid: 'super-1', token: { role: 'provincial_superadmin' } },
            data: { level: 'light' },
        });
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('test-project.cloudfunctions.net'), expect.objectContaining({
            method: 'GET',
            signal: expect.any(AbortSignal),
        }));
    });
});
//# sourceMappingURL=prewarm-surge.test.js.map