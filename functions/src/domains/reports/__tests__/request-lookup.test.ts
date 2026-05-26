import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

const { mockCheckRateLimit, mockFirestore, onCallMock } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockFirestore: vi.fn(),
  onCallMock: vi.fn((_config: unknown, handler: unknown) => handler),
}))

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  )
  return { ...actual, onCall: onCallMock }
})

vi.mock('firebase-admin/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase-admin/firestore')>(
    'firebase-admin/firestore',
  )
  return { ...actual, getFirestore: mockFirestore }
})

vi.mock('../../shared/rate-limit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

import { requestLookup, requestLookupImpl } from '../request-lookup.js'

const mockGet = vi.fn()

function db() {
  return {
    collection: () => ({ doc: () => ({ get: mockGet }) }),
  }
}

beforeEach(() => {
  mockGet.mockReset()
  mockCheckRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 29,
    retryAfterSeconds: 0,
  })
  mockFirestore.mockReturnValue(db())
})

describe('requestLookupImpl — both-codes path', () => {
  const secret = 'abc'
  const tokenHash = createHash('sha256').update(secret).digest('hex')

  it('returns NOT_FOUND when the public ref does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false })
    await expect(
      requestLookupImpl({ db: db() as never, data: { publicRef: 'a1b2c3d4', secret } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns FORBIDDEN on secret mismatch', async () => {
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

  it('returns status + publicRef on success', async () => {
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
      publicRef: 'a1b2c3d4',
      status: 'verified',
      lastStatusAt: 1713350401000,
      municipalityLabel: 'Daet',
    })
  })
})

describe('requestLookupImpl — secret-only path', () => {
  const secret = 'abc'

  it('returns UNAUTHORIZED when auth is absent', async () => {
    await expect(
      requestLookupImpl({ db: db() as never, data: { secret }, auth: undefined }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('returns NOT_FOUND when secret_lookup doc does not exist', async () => {
    mockGet.mockResolvedValue({ exists: false })
    await expect(
      requestLookupImpl({ db: db() as never, data: { secret }, auth: { uid: 'u1' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns NOT_FOUND when secret_lookup entry is expired', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ publicRef: 'a1b2c3d4', reportId: 'r1', expiresAt: Date.now() - 1 }),
    })
    await expect(
      requestLookupImpl({ db: db() as never, data: { secret }, auth: { uid: 'u1' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('returns status + publicRef on success', async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ publicRef: 'a1b2c3d4', reportId: 'r1', expiresAt: Date.now() + 1e6 }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: 'awaiting_verify',
          municipalityLabel: 'Daet',
          submittedAt: 1713350400000,
          updatedAt: 1713350401000,
        }),
      })
    const result = await requestLookupImpl({
      db: db() as never,
      data: { secret },
      auth: { uid: 'u1' },
    })
    expect(result).toEqual({
      publicRef: 'a1b2c3d4',
      status: 'awaiting_verify',
      lastStatusAt: 1713350401000,
      municipalityLabel: 'Daet',
    })
  })
})

describe('requestLookup callable', () => {
  it('does not leak unexpected backend error messages to public callers', async () => {
    mockGet.mockRejectedValueOnce(new Error('index secret_lookup/private missing in prod'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const handler = requestLookup as unknown as (request: {
      auth?: { uid: string } | undefined
      data: unknown
      rawRequest: { ip?: string }
    }) => Promise<unknown>

    try {
      await expect(
        handler({
          auth: undefined,
          data: { publicRef: 'a1b2c3d4', secret: 'abc' },
          rawRequest: { ip: '203.0.113.10' },
        }),
      ).rejects.toMatchObject({
        code: 'internal',
        message: 'Lookup failed.',
      })
    } finally {
      consoleError.mockRestore()
    }
  })
})
