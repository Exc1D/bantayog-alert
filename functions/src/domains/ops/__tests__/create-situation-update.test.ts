import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const { mockCheckRateLimit, mockAdd } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockAdd: vi.fn(),
}))

// fallow-ignore-next-line code-duplication
vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: unknown, fn: unknown) => fn),
  HttpsError: class HttpsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('../../../admin-init.js', () => ({
  adminDb: { collection: vi.fn(() => ({ add: mockAdd })) },
}))

vi.mock('../../shared/rate-limit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('../../shared/app-check-config.js', () => ({
  shouldEnforceAppCheck: vi.fn(() => false),
}))

vi.mock('../../shared/callable-config.js', () => ({
  getCitizenCallableCorsOrigins: vi.fn(() => []),
}))

import {
  createSituationUpdate,
  createSituationUpdateCore,
  inputSchema,
} from '../create-situation-update.js'

beforeEach(() => {
  mockAdd.mockReset().mockResolvedValue({ id: 'wrapper-update' })
  mockCheckRateLimit.mockReset().mockResolvedValue({
    allowed: true,
    remaining: 4,
    retryAfterSeconds: 0,
  })
})

function createMockDb() {
  const add = vi.fn().mockResolvedValue({ id: 'new-update' })
  const collection = vi.fn(() => ({ add }))
  return { collection, _add: add } as unknown as Firestore & { _add: typeof add }
}

const validInput = {
  municipalityId: 'daet',
  municipalityLabel: 'Daet',
  barangayLabel: 'San Jose',
  hazardType: 'typhoon',
  condition: 'heavy_rain',
  body: 'Strong rain near the market.',
}

describe('createSituationUpdateCore', () => {
  it('writes the canonical public update doc for the caller', async () => {
    const db = createMockDb()

    const result = await createSituationUpdateCore(db, {
      uid: 'citizen-1',
      input: inputSchema.parse(validInput),
      now: 1234,
    })

    expect(result).toEqual({ updateId: 'new-update' })
    expect(db.collection).toHaveBeenCalledWith('situation_updates')
    expect(db._add).toHaveBeenCalledWith({
      authorUid: 'citizen-1',
      createdAt: 1234,
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayLabel: 'San Jose',
      hazardType: 'typhoon',
      condition: 'heavy_rain',
      body: 'Strong rain near the market.',
      visibility: 'public',
      reportedCount: 0,
    })
  })

  it('omits blank optional barangay labels from the stored doc', async () => {
    const db = createMockDb()

    await createSituationUpdateCore(db, {
      uid: 'citizen-1',
      input: inputSchema.parse({ ...validInput, barangayLabel: '   ' }),
      now: 1234,
    })

    const payload = db._add.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('barangayLabel')
  })
})

describe('inputSchema', () => {
  it('trims the body and rejects out-of-range lengths', () => {
    expect(inputSchema.parse({ ...validInput, body: '  ok body  ' }).body).toBe('ok body')
    expect(() => inputSchema.parse({ ...validInput, body: 'x'.repeat(501) })).toThrow()
    expect(() => inputSchema.parse({ ...validInput, body: 'ab' })).toThrow()
  })

  it('rejects unknown hazard types, conditions, and extra keys', () => {
    expect(() => inputSchema.parse({ ...validInput, hazardType: 'meteor' })).toThrow()
    expect(() => inputSchema.parse({ ...validInput, condition: 'lava' })).toThrow()
    expect(() => inputSchema.parse({ ...validInput, visibility: 'public' })).toThrow()
  })
})

function createRequest(
  overrides: Partial<{
    auth: { uid: string; token: Record<string, unknown> } | undefined
    data: Record<string, unknown>
  }> = {},
) {
  return {
    auth:
      'auth' in overrides
        ? overrides.auth
        : { uid: 'citizen-1', token: { role: 'citizen', accountStatus: 'active' } },
    data: overrides.data ?? validInput,
  }
}

// The exported callable IS the handler function because our onCall mock returns it
const handler = createSituationUpdate as unknown as (request: {
  auth?: { uid: string; token: Record<string, unknown> } | undefined
  data: unknown
}) => Promise<unknown>

describe('createSituationUpdate callable wrapper', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(handler(createRequest({ auth: undefined }))).rejects.toMatchObject({
      code: 'unauthenticated',
      message: 'Must be signed in to post an update.',
    })
  })

  it('rejects inactive accounts', async () => {
    await expect(
      handler(
        createRequest({
          auth: { uid: 'citizen-1', token: { role: 'citizen', accountStatus: 'suspended' } },
        }),
      ),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Account is not active.',
    })
  })

  it('rejects malformed payloads', async () => {
    await expect(
      handler(createRequest({ data: { ...validInput, hazardType: 'meteor' } })),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Invalid situation update payload.',
    })
  })

  it('rejects rate-limited callers', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 120,
    })

    await expect(handler(createRequest())).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: 'Too many posts. Try again in a few minutes.',
    })
  })

  it('creates the update for an active signed-in caller', async () => {
    await expect(handler(createRequest())).resolves.toEqual({ updateId: 'wrapper-update' })

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ key: 'createSituationUpdate:citizen-1' }),
    )
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ authorUid: 'citizen-1', visibility: 'public' }),
    )
  })
})
