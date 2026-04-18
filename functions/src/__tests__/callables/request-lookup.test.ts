import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { requestLookupImpl } from '../../callables/request-lookup.js'

const mockGet = vi.fn()

function db() {
  return {
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  }
}

beforeEach(() => mockGet.mockReset())

describe('requestLookupImpl', () => {
  const secret = 'abc'
  const tokenHash = createHash('sha256').update(secret).digest('hex')

  it('returns NOT_FOUND when the public ref does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns PERMISSION_DENIED on secret mismatch', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ reportId: 'r1', tokenHash: 'x'.repeat(64), expiresAt: Date.now() + 1e6 }),
    })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret: 'wrong' } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('returns NOT_FOUND when expired', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ reportId: 'r1', tokenHash, expiresAt: Date.now() - 1 }),
    })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns sanitized status on success', async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ reportId: 'r1', tokenHash, expiresAt: Date.now() + 1e6 }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'verified',
          municipalityLabel: 'Daet',
          submittedAt: 1713350400000,
          updatedAt: 1713350401000,
        }),
      })
    const result = await requestLookupImpl({
      db: db() as never,
      data: { publicRef: 'a1b2c3d4', secret },
    })
    expect(result).toEqual({
      status: 'verified',
      lastStatusAt: 1713350401000,
      municipalityLabel: 'Daet',
    })
  })
})
