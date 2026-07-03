/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  adminAuth: {
    getUserByPhoneNumber: vi.fn(),
    createUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
    deleteUser: vi.fn(),
  },
}))

vi.mock('../../../admin-init.js', () => ({
  adminAuth: mocks.adminAuth,
  adminDb: {},
}))

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

vi.mock('firebase-admin/firestore', () => ({
  Firestore: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: vi.fn(() => 1713350400000) })),
    fromMillis: vi.fn((ms: number) => ({ toMillis: vi.fn(() => ms) })),
  },
}))

vi.mock('../../../idempotency/guard.js', () => ({
  withIdempotency: vi.fn(async (_db, _opts, op) => ({ result: await op(), fromCache: false })),
}))

vi.mock('../../shared/rate-limit.js', () => ({
  checkRateLimit: vi.fn(() =>
    Promise.resolve({ allowed: true, remaining: 9, retryAfterSeconds: 0 }),
  ),
}))

import { Timestamp } from 'firebase-admin/firestore'
import { createResponderCore } from '../create-responder.js'

function baseDeps(overrides: Partial<Parameters<typeof createResponderCore>[1]> = {}) {
  return {
    displayName: 'Test Responder',
    phone: '+639171234567',
    agencyId: 'bfp-daet',
    idempotencyKey: crypto.randomUUID(),
    actor: {
      uid: 'agency-admin-1',
      claims: {
        role: 'agency_admin',
        agencyId: 'bfp-daet',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
      },
    },
    now: Timestamp.now(),
    ...overrides,
  }
}

function makeDb() {
  const tx = { set: vi.fn() }
  const db = {
    collection: vi.fn((collectionName: string) => ({
      doc: vi.fn((id?: string) => ({
        id: id ?? collectionName + '-auto-id',
        path: collectionName + '/' + (id ?? 'auto-id'),
      })),
    })),
    runTransaction: vi.fn(async (op: (txArg: typeof tx) => unknown) => await op(tx)),
  }
  return { db: db as any as Parameters<typeof createResponderCore>[0], tx }
}

describe('createResponderCore jurisdiction guard success paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.adminAuth.getUserByPhoneNumber.mockRejectedValue({ code: 'auth/user-not-found' })
    mocks.adminAuth.createUser.mockResolvedValue({ uid: 'responder-uid' })
    mocks.adminAuth.setCustomUserClaims.mockResolvedValue(undefined)
    mocks.adminAuth.deleteUser.mockResolvedValue(undefined)
  })

  it('accepts when municipalityId equals actor.claims.municipalityId', async () => {
    const { db } = makeDb()

    await expect(createResponderCore(db, baseDeps({ municipalityId: 'daet' }))).resolves.toEqual({
      uid: 'responder-uid',
      agencyId: 'bfp-daet',
      availabilityStatus: 'available',
    })

    expect(mocks.adminAuth.setCustomUserClaims).toHaveBeenCalledWith(
      'responder-uid',
      expect.objectContaining({ municipalityId: 'daet' }),
    )
  })

  it('accepts when municipalityId is included in permittedMunicipalityIds', async () => {
    const { db } = makeDb()

    await expect(
      createResponderCore(
        db,
        baseDeps({
          municipalityId: 'labo',
          actor: {
            uid: 'agency-admin-1',
            claims: {
              role: 'agency_admin',
              agencyId: 'bfp-daet',
              municipalityId: 'daet',
              permittedMunicipalityIds: ['daet', 'labo'],
            },
          },
        }),
      ),
    ).resolves.toEqual({
      uid: 'responder-uid',
      agencyId: 'bfp-daet',
      availabilityStatus: 'available',
    })

    expect(mocks.adminAuth.setCustomUserClaims).toHaveBeenCalledWith(
      'responder-uid',
      expect.objectContaining({
        municipalityId: 'labo',
        permittedMunicipalityIds: ['labo'],
      }),
    )
  })
})
