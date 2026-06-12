/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCheckRateLimit, mockIsAccountActive, onCallMock } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockIsAccountActive: vi.fn(),
  onCallMock: vi.fn((_config: unknown, handler: unknown) => handler),
}))

vi.mock('firebase-functions/v2/https', () => ({
  onCall: onCallMock,
  HttpsError: class HttpsError extends Error {
    code: string
    data?: unknown
    constructor(code: string, message: string, data?: unknown) {
      super(message)
      this.code = code
      this.data = data
    }
  },
}))

vi.mock('../../../admin-init.js', () => ({
  adminDb: {
    runTransaction: vi
      .fn()
      .mockResolvedValue({ reportId: 'report-1', addressed: true, submittedAt: 1, updatedAt: 1 }),
  },
}))

vi.mock('../../shared/rate-limit.js', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('../../ops/admin-auth.js', () => ({
  isAccountActive: mockIsAccountActive,
}))

vi.mock('../../shared/app-check-config.js', () => ({
  shouldEnforceAppCheck: vi.fn(() => false),
}))

vi.mock('../../shared/callable-config.js', () => ({
  getCitizenCallableCorsOrigins: vi.fn(() => []),
}))

// Import after all mocks are set up
import { submitReportFeedback } from '../submit-report-feedback.js'

beforeEach(() => {
  mockCheckRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 29,
    retryAfterSeconds: 0,
  })
  mockIsAccountActive.mockImplementation(
    (claims: Record<string, unknown>) => claims.accountStatus === 'active',
  )
})

afterEach(() => {
  vi.restoreAllMocks()
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
    data: overrides.data ?? { reportId: 'report-1', addressed: true },
  }
}

// The exported callable IS the handler function because our onCall mock returns it
const handler = submitReportFeedback as unknown as (request: {
  auth?: { uid: string; token: Record<string, unknown> } | undefined
  data: unknown
}) => Promise<unknown>

describe('submitReportFeedback callable wrapper', () => {
  it('rejects unauthenticated callers', async () => {
    await expect(handler(createRequest({ auth: undefined }))).rejects.toMatchObject({
      code: 'unauthenticated',
      message: 'sign-in required',
    })
  })

  it('rejects callers with missing auth token', async () => {
    await expect(
      handler(createRequest({ auth: { uid: 'citizen-1', token: null as any } })),
    ).rejects.toMatchObject({
      code: 'unauthenticated',
      message: 'sign-in required',
    })
  })

  it('rejects non-citizen roles', async () => {
    await expect(
      handler(
        createRequest({
          auth: { uid: 'responder-1', token: { role: 'responder', accountStatus: 'active' } },
        }),
      ),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'citizen role required',
    })
  })

  it('rejects municipal_admin roles', async () => {
    await expect(
      handler(
        createRequest({
          auth: { uid: 'admin-1', token: { role: 'municipal_admin', accountStatus: 'active' } },
        }),
      ),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'citizen role required',
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
      message: 'account is not active',
    })
  })

  it('rejects malformed payload (missing reportId)', async () => {
    await expect(handler(createRequest({ data: { addressed: true } }))).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'malformed payload',
    })
  })

  it('rejects malformed payload (invalid addressed type)', async () => {
    await expect(
      handler(createRequest({ data: { reportId: 'report-1', addressed: 'yes' } })),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'malformed payload',
    })
  })

  it('rejects rate-limited callers', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 45,
    })

    await expect(handler(createRequest())).rejects.toMatchObject({
      code: 'resource-exhausted',
      message: 'rate limit exceeded',
    })
  })
})
