import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestUploadUrlImpl } from '../../callables/request-upload-url.js'
import { BantayogErrorCode } from '@bantayog/shared-validators'

const mockSignedUrl = vi.fn().mockResolvedValue(['https://signed.example/put'] as string[])

vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      file: () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getSignedUrl: mockSignedUrl as any,
      }),
    }),
  }),
}))

beforeEach(() => {
  mockSignedUrl.mockResolvedValue(['https://signed.example/put'] as string[])
})

describe('requestUploadUrlImpl', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(
      requestUploadUrlImpl({
        auth: undefined,
        data: { mimeType: 'image/jpeg', sizeBytes: 1024, sha256: 'a'.repeat(64) },
        bucket: 'test-bucket',
      }),
    ).rejects.toMatchObject({ code: BantayogErrorCode.UNAUTHORIZED })
  })

  it('rejects disallowed MIME types', async () => {
    await expect(
      requestUploadUrlImpl({
        auth: { uid: 'c1' },
        data: { mimeType: 'application/pdf', sizeBytes: 1024, sha256: 'a'.repeat(64) },
        bucket: 'test-bucket',
      }),
    ).rejects.toMatchObject({ code: BantayogErrorCode.INVALID_ARGUMENT })
  })

  it('rejects oversized uploads', async () => {
    await expect(
      requestUploadUrlImpl({
        auth: { uid: 'c1' },
        data: { mimeType: 'image/jpeg', sizeBytes: 11 * 1024 * 1024, sha256: 'a'.repeat(64) },
        bucket: 'test-bucket',
      }),
    ).rejects.toMatchObject({ code: BantayogErrorCode.INVALID_ARGUMENT })
  })

  it('returns a signed URL and uploadId for a valid request', async () => {
    const result = await requestUploadUrlImpl({
      auth: { uid: 'c1' },
      data: { mimeType: 'image/jpeg', sizeBytes: 1024, sha256: 'a'.repeat(64) },
      bucket: 'test-bucket',
    })
    expect(result.uploadUrl).toBe('https://signed.example/put')
    expect(result.uploadId).toMatch(/^[0-9a-f-]{36}$/)
    expect(result.storagePath).toBe(`pending/${result.uploadId}`)
  })
})
