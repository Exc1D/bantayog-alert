import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc, Timestamp } from 'firebase/firestore'
import { type Firestore, getFirestore } from 'firebase-admin/firestore'
import { initializeApp, deleteApp, type App } from 'firebase-admin/app'

const onCallMock = vi.hoisted(() => vi.fn())
vi.mock('firebase-functions/v2/https', () => ({
  onCall: onCallMock,
  HttpsError: class HttpsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))
vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminApp: App
let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import {
  initiateResponderHandoffCore,
  acceptResponderHandoffCore,
} from '../../callables/responder-shift-handoff.js'

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const ts = 1713350400000
let testEnv: RulesTestEnvironment
const _origEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST

beforeAll(async () => {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081'
  testEnv = await initializeTestEnvironment({
    projectId: 'responder-handoff-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminApp = initializeApp({ projectId: 'responder-handoff-test' }, 'responder-handoff-test')
  adminDb = getFirestore(adminApp)
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv.cleanup()
  await deleteApp(adminApp)
  if (_origEmulatorHost === undefined) {
    delete process.env.FIRESTORE_EMULATOR_HOST
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = _origEmulatorHost
  }
})

function makeActor(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    uid,
    claims: {
      role: 'responder',
      accountStatus: 'active',
      agencyId: 'agency-1',
      municipalityId: 'muni-1',
      ...overrides,
    },
  }
}

async function seedResponder(responderId: string, overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'responders', responderId), {
      uid: responderId,
      municipalityId: 'muni-1',
      name: 'Test Responder',
      phoneNumber: '+1234567890',
      isActive: true,
      agencyId: 'agency-1',
      currentStatus: 'available',
      lastLocationUpdate: ts,
      createdAt: ts,
      schemaVersion: 1,
      ...overrides,
    })
  })
}

async function createHandoff(id: string, overrides: Record<string, unknown> = {}) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'responder_shift_handoffs', id), {
      fromUid: 'from-responder',
      toUid: 'to-responder',
      agencyId: 'agency-1',
      municipalityId: 'muni-1',
      reason: 'shift ended',
      status: 'pending',
      createdAt: Timestamp.fromMillis(ts),
      expiresAt: Timestamp.fromMillis(Date.now() + 1800000),
      schemaVersion: 1,
      ...overrides,
    })
  })
}

describe('initiateResponderHandoffCore', () => {
  it('should reject when actor account status is not active', async () => {
    const result = await initiateResponderHandoffCore(
      adminDb,
      { toUid: 'responder-b', reason: 'shift ended', idempotencyKey: uuid(1) },
      makeActor('responder-a', { accountStatus: 'inactive' }),
      'corr-1',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('permission-denied')
    }
  })

  it('should reject when toUid equals actor uid', async () => {
    const result = await initiateResponderHandoffCore(
      adminDb,
      { toUid: 'responder-a', reason: 'shift ended', idempotencyKey: uuid(2) },
      makeActor('responder-a'),
      'corr-2',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('invalid-argument')
    }
  })

  it('should reject when toUid responder is not found', async () => {
    await seedResponder('responder-a')
    const result = await initiateResponderHandoffCore(
      adminDb,
      { toUid: 'responder-b', reason: 'shift ended', idempotencyKey: uuid(3) },
      makeActor('responder-a'),
      'corr-3',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('not-found')
    }
  })

  it('should create handoff document when valid', async () => {
    await seedResponder('responder-a')
    await seedResponder('responder-b')
    const result = await initiateResponderHandoffCore(
      adminDb,
      { toUid: 'responder-b', reason: 'shift ended', idempotencyKey: uuid(4) },
      makeActor('responder-a'),
      'corr-4',
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(typeof result.handoffId).toBe('string')
      expect(result.handoffId.length).toBeGreaterThan(0)
    }
  })

  it('should be idempotent when called twice with the same idempotencyKey', async () => {
    await seedResponder('responder-a')
    await seedResponder('responder-b')
    const input = { toUid: 'responder-b', reason: 'shift ended', idempotencyKey: uuid(5) }
    const result1 = await initiateResponderHandoffCore(
      adminDb,
      input,
      makeActor('responder-a'),
      'corr-5a',
    )
    const result2 = await initiateResponderHandoffCore(
      adminDb,
      input,
      makeActor('responder-a'),
      'corr-5b',
    )
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    if (result1.success && result2.success) {
      expect(result1.handoffId).toBe(result2.handoffId)
    }
  })
})

describe('acceptResponderHandoffCore', () => {
  it('should reject when handoff is not found', async () => {
    const result = await acceptResponderHandoffCore(
      adminDb,
      { handoffId: 'missing-handoff', idempotencyKey: uuid(6) },
      makeActor('responder-b'),
      'corr-6',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('not-found')
    }
  })

  it('should reject when accepting uid is not the toUid', async () => {
    await createHandoff('handoff-1', { toUid: 'other-responder' })
    const result = await acceptResponderHandoffCore(
      adminDb,
      { handoffId: 'handoff-1', idempotencyKey: uuid(7) },
      makeActor('responder-b'),
      'corr-7',
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errorCode).toBe('permission-denied')
    }
  })

  it('should mark handoff as accepted', async () => {
    await createHandoff('handoff-2', { toUid: 'responder-b' })
    const result = await acceptResponderHandoffCore(
      adminDb,
      { handoffId: 'handoff-2', idempotencyKey: uuid(8) },
      makeActor('responder-b'),
      'corr-8',
    )
    expect(result.success).toBe(true)
    const updated = await adminDb.collection('responder_shift_handoffs').doc('handoff-2').get()
    expect(updated.data()?.status).toBe('accepted')
  })
})
