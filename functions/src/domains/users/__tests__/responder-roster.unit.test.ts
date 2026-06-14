import { describe, expect, it, vi, beforeEach } from 'vitest'

// fallow-ignore-next-line code-duplication
const { adminDbMock, setCustomUserClaimsMock, revokeRefreshTokensMock } = vi.hoisted(() => ({
  adminDbMock: { collection: vi.fn(), runTransaction: vi.fn() },
  setCustomUserClaimsMock: vi.fn(),
  revokeRefreshTokensMock: vi.fn(),
}))

// fallow-ignore-next-line code-duplication
vi.mock('../../../admin-init.js', () => ({
  // fallow-ignore-next-line code-duplication
  adminAuth: {
    setCustomUserClaims: setCustomUserClaimsMock,
    revokeRefreshTokens: revokeRefreshTokensMock,
  },
  // fallow-ignore-next-line code-duplication
  adminDb: adminDbMock,
}))

vi.mock('../../../idempotency/guard.js', () => ({
  withIdempotency: vi.fn(async (_db, _opts, op) => ({ result: await op(), fromCache: false })),
}))

vi.mock('../../shared/rate-limit.js', () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSeconds: 0 })),
}))

vi.mock('../../shared/app-check-config.js', () => ({
  shouldEnforceAppCheck: () => false,
}))

// fallow-ignore-next-line code-duplication
vi.mock('firebase-admin/firestore', () => ({
  // fallow-ignore-next-line code-duplication
  Firestore: vi.fn(),
  // fallow-ignore-next-line code-duplication
  FieldPath: { documentId: vi.fn(() => '__name__') },
  // fallow-ignore-next-line code-duplication
  Timestamp: {
    // fallow-ignore-next-line code-duplication
    now: vi.fn(() => ({ toMillis: vi.fn(() => 1765000000000) })),
  },
}))

// fallow-ignore-next-line code-duplication
vi.mock('firebase-functions/v2/https', async () => {
  // fallow-ignore-next-line code-duplication
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  )
  // fallow-ignore-next-line code-duplication
  return { ...actual, onCall: vi.fn((_config: unknown, handler: unknown) => handler) }
})

import { suspendResponder } from '../responder-roster.js'

interface TxUpdate {
  ref: string
  accountStatus?: string
  availabilityStatus?: string
  updatedAt?: number
}

interface ResponderDoc {
  agencyId?: string
  accountStatus?: string
  municipalityId?: string | null
  mfaEnrolled?: boolean
}

function mockDb(responder: ResponderDoc | undefined) {
  const txUpdates: TxUpdate[] = []
  const responderDoc = {
    path: 'responders/responder-1',
    get: vi.fn().mockResolvedValue({
      exists: responder !== undefined,
      data: () => responder,
    }),
  }

  const tx = {
    get: vi.fn().mockResolvedValue({
      exists: responder !== undefined,
      data: () => responder,
    }),
    update: vi.fn((ref: { path: string }, data: TxUpdate) => {
      txUpdates.push({ ...data, ref: ref.path })
    }),
  }

  const db = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id: string) =>
        name === 'responders' && id === 'responder-1' ? responderDoc : { path: `${name}/${id}` },
      ),
    })),
    runTransaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }

  return { db, txUpdates }
}

describe('suspendResponder Auth propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setCustomUserClaimsMock.mockResolvedValue(undefined)
    revokeRefreshTokensMock.mockResolvedValue(undefined)
  })

  it('updates responder Auth claims after Firestore status changes', async () => {
    const { db, txUpdates } = mockDb({
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      accountStatus: 'active',
      mfaEnrolled: true,
    })
    adminDbMock.collection.mockImplementation(db.collection)
    adminDbMock.runTransaction.mockImplementation(db.runTransaction)

    await suspendResponder(
      {
        auth: {
          uid: 'admin-1',
          token: {
            role: 'agency_admin',
            agencyId: 'bfp-daet',
            accountStatus: 'active',
          },
        },
        data: {
          uid: 'responder-1',
          idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        },
      } as never,
      {} as never,
    )

    expect(txUpdates).toEqual([
      {
        ref: 'responders/responder-1',
        accountStatus: 'suspended',
        availabilityStatus: 'off_duty',
        updatedAt: 1765000000000,
      },
    ])
    expect(setCustomUserClaimsMock).toHaveBeenCalledWith('responder-1', {
      role: 'responder',
      accountStatus: 'suspended',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      permittedMunicipalityIds: ['daet'],
      mfaEnrolled: true,
      lastClaimIssuedAt: 1765000000000,
    })
    expect(revokeRefreshTokensMock).toHaveBeenCalledWith('responder-1')
  })
})
