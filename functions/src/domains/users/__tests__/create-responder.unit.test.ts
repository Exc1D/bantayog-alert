import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin before importing callable modules
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({
    getOrInitService: vi.fn(() => ({})),
  })),
}))

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({})),
}))

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  Firestore: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toMillis: vi.fn(() => Date.now()) })),
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

function baseDeps(overrides: Partial<Parameters<typeof createResponderCore>[1]>) {
  return {
    displayName: 'Test Responder',
    phone: '+639171234567',
    agencyId: 'bfp-daet',
    idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
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

describe('createResponderCore jurisdiction guard', () => {
  it('rejects a supplied municipalityId outside caller jurisdiction', async () => {
    const db = {} as Parameters<typeof createResponderCore>[0]
    await expect(createResponderCore(db, baseDeps({ municipalityId: 'labo' }))).rejects.toThrow(
      'municipalityId outside caller jurisdiction',
    )
  })

  it('rejects when caller has no municipality scope at all', async () => {
    const db = {} as Parameters<typeof createResponderCore>[0]
    await expect(
      createResponderCore(
        db,
        baseDeps({
          municipalityId: 'daet',
          actor: {
            uid: 'agency-admin-1',
            claims: { role: 'agency_admin', agencyId: 'bfp-daet' },
          },
        }),
      ),
    ).rejects.toThrow('municipalityId outside caller jurisdiction')
  })
})
