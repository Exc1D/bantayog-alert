import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BantayogErrorCode } from '@bantayog/shared-validators';
const { mockCheckRateLimit, onCallMock } = vi.hoisted(() => ({
    mockCheckRateLimit: vi.fn(),
    onCallMock: vi.fn((_config, handler) => handler),
}));
const mockSignedUrl = vi.fn().mockResolvedValue(['https://signed.example/put']);
vi.mock('firebase-functions/v2/https', async () => {
    const actual = await vi.importActual('firebase-functions/v2/https');
    return { ...actual, onCall: onCallMock };
});
vi.mock('firebase-admin/storage', () => ({
    getStorage: () => ({
        bucket: () => ({
            file: () => ({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                getSignedUrl: mockSignedUrl,
            }),
        }),
    }),
}));
vi.mock('../../admin-init.js', () => ({ adminDb: {} }));
vi.mock('../../shared/rate-limit.js', () => ({
    checkRateLimit: mockCheckRateLimit,
}));
import { requestUploadUrl, requestUploadUrlImpl } from '../callables.js';
beforeEach(() => {
    mockSignedUrl.mockResolvedValue(['https://signed.example/put']);
    mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 19,
        retryAfterSeconds: 0,
    });
});
describe('requestUploadUrlImpl', () => {
    it('rejects unauthenticated callers', async () => {
        await expect(requestUploadUrlImpl({
            auth: undefined,
            data: { mimeType: 'image/jpeg', sizeBytes: 1024, sha256: 'a'.repeat(64) },
            bucket: 'test-bucket',
        })).rejects.toMatchObject({ code: BantayogErrorCode.UNAUTHORIZED });
    });
    it('rejects disallowed MIME types', async () => {
        await expect(requestUploadUrlImpl({
            auth: { uid: 'c1' },
            data: { mimeType: 'application/pdf', sizeBytes: 1024, sha256: 'a'.repeat(64) },
            bucket: 'test-bucket',
        })).rejects.toMatchObject({ code: BantayogErrorCode.INVALID_ARGUMENT });
    });
    it('rejects oversized uploads', async () => {
        await expect(requestUploadUrlImpl({
            auth: { uid: 'c1' },
            data: { mimeType: 'image/jpeg', sizeBytes: 11 * 1024 * 1024, sha256: 'a'.repeat(64) },
            bucket: 'test-bucket',
        })).rejects.toMatchObject({ code: BantayogErrorCode.INVALID_ARGUMENT });
    });
    it('returns a signed URL and uploadId for a valid request', async () => {
        const result = await requestUploadUrlImpl({
            auth: { uid: 'c1' },
            data: { mimeType: 'image/jpeg', sizeBytes: 1024, sha256: 'a'.repeat(64) },
            bucket: 'test-bucket',
        });
        expect(result.uploadUrl).toBe('https://signed.example/put');
        expect(result.uploadId).toMatch(/^[0-9a-f-]{36}$/);
        // Storage path is user-bound: pending/{uid}/{uploadId}
        expect(result.storagePath).toBe(`pending/c1/${result.uploadId}`);
    });
});
describe('requestUploadUrl callable', () => {
    it('does not leak unexpected storage signing errors to clients', async () => {
        mockSignedUrl.mockRejectedValueOnce(new Error('serviceAccount private key missing for prod'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const handler = requestUploadUrl;
        try {
            await expect(handler({
                auth: { uid: 'c1' },
                data: { mimeType: 'image/jpeg', sizeBytes: 1024, sha256: 'a'.repeat(64) },
            })).rejects.toMatchObject({
                code: 'internal',
                message: 'Failed to create upload URL.',
            });
        }
        finally {
            consoleError.mockRestore();
        }
    });
});
//# sourceMappingURL=callables.test.js.map