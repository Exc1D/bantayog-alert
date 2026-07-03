/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'

const itif = (condition: boolean) => (condition ? it : it.skip)

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))

let adminDb: Firestore
vi.mock('../../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { monitorDispatchDeadlinesCore } from '../monitor-dispatch-deadlines.js'

const ts = 1713350400000
const guarded = await guardInitTestEnvironment(
  {
    projectId: 'dispatch-monitor-alert-accumulation-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  },
  'monitor-dispatch-deadline-alert-accumulation',
)
const testEnv: RulesTestEnvironment | undefined = guarded.env
const available = guarded.available

if (available) {
  adminDb = testEnv!.unauthenticatedContext().firestore() as unknown as Firestore
}

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv?.cleanup()
})

const config = {
  autoEscalationEnabled: true,
  maxDispatchesPerRun: 50,
  maxEscalationsPerRun: 50,
  enableCircuitBreaker: false,
  circuitBreakerThreshold: 100,
  circuitBreakerErrorThreshold: 10,
  updatedAt: 0,
  updatedBy: 'system',
}

async function seedNeedsAdminDispatch(ctx: any, id: string, municipalityId: string) {
  await setDoc(doc(ctx.firestore(), 'dispatches', id), {
    status: 'pending',
    reportId: 'r1',
    assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId },
    municipalityId,
    acknowledgementDeadlineAt: ts - 60000,
    monitorLeaseAt: ts - 180000,
    escalationCount: 1,
    previouslyNotifiedResponderUids: ['responder-1'],
    createdAt: ts - 300000,
  })
}

describe('monitorDispatchDeadlines — alert accumulation', () => {
  itif(available)('adds new needs_admin counts to an existing alert doc', async () => {
    const dateStr = new Date(ts).toISOString().slice(0, 10)

    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'alerts', 'daet_' + dateStr), {
        type: 'dispatch_deadline_exceeded',
        municipalityId: 'daet',
        count: 5,
        lastUpdatedAt: ts - 1,
      })
      await seedNeedsAdminDispatch(ctx, 'd1', 'daet')
      await seedNeedsAdminDispatch(ctx, 'd2', 'daet')
    })

    await monitorDispatchDeadlinesCore(adminDb, { now: ts, config })

    const alert = await adminDb.collection('alerts').doc('daet_' + dateStr).get()
    expect(alert.data()).toEqual(
      expect.objectContaining({
        type: 'dispatch_deadline_exceeded',
        municipalityId: 'daet',
        count: 7,
        lastUpdatedAt: ts,
      }),
    )
  })
})
