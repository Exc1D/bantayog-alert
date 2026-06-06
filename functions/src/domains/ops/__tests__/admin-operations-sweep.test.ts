import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)
import { setDoc, doc } from 'firebase/firestore'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { adminOperationsSweepCore } from '../admin-operations-sweep.js'

const ts = 1713350400000
const THIRTY_MIN_MS = 30 * 60 * 1000
let testEnv: RulesTestEnvironment | undefined
let available = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'admin-sweep-test',
      firestore: {
        host: 'localhost',
        port: 8081,
        rules:
          'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
      },
    },
    'admin-operations-sweep',
  )
  testEnv = guarded.env
  available = guarded.available
  if (!available) return
  adminDb = testEnv!.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})
afterAll(async () => {
  await testEnv?.cleanup()
})

describe('adminOperationsSweep — agency assistance escalation', () => {
  itif(available)('ignores requests pending for less than 30 minutes', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agency_assistance_requests', 'ar1'), {
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS + 60000,
        reportId: 'r1',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP',
        message: '',
        priority: 'normal',
        fulfilledByDispatchIds: [],
        expiresAt: ts + 3600000,
        escalatedAt: null,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('agency_assistance_requests').doc('ar1').get()
    expect(snap.data()?.escalatedAt).toBeNull()
  })

  itif(available)('sets escalatedAt on requests pending over 30 minutes', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agency_assistance_requests', 'ar1'), {
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS - 1,
        reportId: 'r1',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP',
        message: '',
        priority: 'normal',
        fulfilledByDispatchIds: [],
        expiresAt: ts + 3600000,
        escalatedAt: null,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('agency_assistance_requests').doc('ar1').get()
    expect(snap.data()?.escalatedAt).toBe(ts)
  })

  itif(available)('does not re-escalate already-escalated requests', async () => {
    const originalEscalatedAt = ts - 60000
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'agency_assistance_requests', 'ar1'), {
        status: 'pending',
        createdAt: ts - THIRTY_MIN_MS - 1,
        reportId: 'r1',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP',
        message: '',
        priority: 'normal',
        fulfilledByDispatchIds: [],
        expiresAt: ts + 3600000,
        escalatedAt: originalEscalatedAt,
      })
    })
    await adminOperationsSweepCore(adminDb, { now: Timestamp.fromMillis(ts) })
    const snap = await adminDb.collection('agency_assistance_requests').doc('ar1').get()
    expect(snap.data()?.escalatedAt).toBe(originalEscalatedAt) // unchanged
  })
})
