import { describe, it, expect as vitestExpect, vi, beforeEach } from 'vitest'

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    setCustomUserClaims: vi.fn(),
  })),
}))

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        path: 'active_accounts/user-1',
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ role: 'municipal_admin', municipalityId: 'daet', status: 'active' }),
        }),
      })),
    })),
    batch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  })),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: vi.fn(() => Date.now()) })),
  },
}))

vi.mock('../../../admin-init.js', () => ({
  adminAuth: {
    setCustomUserClaims: vi.fn(),
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        path: 'active_accounts/user-1',
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ role: 'municipal_admin', municipalityId: 'daet', status: 'active' }),
        }),
        set: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    batch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
  },
}))

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  )
  return { ...actual, onCall: vi.fn((_config: unknown, handler: unknown) => handler) }
})

vi.mock('@bantayog/shared-types', () => ({
  asAgencyId: (v: string) => v,
  asMunicipalityId: (v: string) => v,
}))

import { setStaffClaims, suspendStaffAccount } from '../account-lifecycle.js'

describe('account-lifecycle security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setStaffClaims', () => {
    it('rejects suspended superadmin', async () => {
      const request = {
        auth: {
          uid: 'admin-1',
          token: {
            role: 'provincial_superadmin',
            accountStatus: 'suspended',
          },
        },
        data: {
          uid: 'user-1',
          role: 'municipal_admin',
          municipalityId: 'daet',
          idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        },
      }

      try {
        await setStaffClaims(request as never, {} as never)
        vitestExpect(true).toBe(false)
      } catch (e) {
        vitestExpect((e as Error).message).toContain('Account is not active.')
      }
    })

    it('allows active superadmin', async () => {
      const request = {
        auth: {
          uid: 'admin-1',
          token: {
            role: 'provincial_superadmin',
            accountStatus: 'active',
          },
        },
        data: {
          uid: 'user-1',
          role: 'municipal_admin',
          municipalityId: 'daet',
          idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        },
      }

      await setStaffClaims(request as never, {} as never)
    })
  })

  describe('suspendStaffAccount', () => {
    it('rejects suspended superadmin', async () => {
      const request = {
        auth: {
          uid: 'admin-1',
          token: {
            role: 'provincial_superadmin',
            accountStatus: 'suspended',
          },
        },
        data: {
          uid: 'user-1',
          idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'suspended',
        },
      }

      try {
        await suspendStaffAccount(request as never, {} as never)
        vitestExpect(true).toBe(false)
      } catch (e) {
        vitestExpect((e as Error).message).toContain('Account is not active.')
      }
    })

    it('allows active superadmin', async () => {
      const request = {
        auth: {
          uid: 'admin-1',
          token: {
            role: 'provincial_superadmin',
            accountStatus: 'active',
          },
        },
        data: {
          uid: 'user-1',
          idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
          reason: 'suspended',
        },
      }

      await suspendStaffAccount(request as never, {} as never)
    })
  })
})
