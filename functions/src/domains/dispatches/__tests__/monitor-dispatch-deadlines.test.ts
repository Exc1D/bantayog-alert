import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)
import { setDoc, doc } from 'firebase/firestore'
import { type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({ getDatabase: vi.fn(() => ({})) }))
let adminDb: Firestore
vi.mock('../../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { monitorDispatchDeadlinesCore } from '../monitor-dispatch-deadlines.js'

const ts = 1713350400000

// Guard must settle before Vitest registers tests: collection-time itif(available)
// with a beforeAll guard silently registers every test as skipped.
const guarded = await guardInitTestEnvironment(
  {
    projectId: 'dispatch-monitor-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  },
  'monitor-dispatch-deadlines',
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

const monitorConfig = {
  autoEscalationEnabled: true,
  maxDispatchesPerRun: 50,
  maxEscalationsPerRun: 50,
  enableCircuitBreaker: false,
  circuitBreakerThreshold: 100,
  circuitBreakerErrorThreshold: 10,
  updatedAt: 0,
  updatedBy: 'system',
}

describe('monitorDispatchDeadlines — deadline exceeded', () => {
  itif(available)('escalates pending dispatch past deadline with expired lease', async () => {
    // Create a dispatch past deadline with expired lease
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
        status: 'pending',
        reportId: 'r1',
        assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        acknowledgementDeadlineAt: ts - 60000, // 1 min past deadline
        monitorLeaseAt: ts - 180000, // lease expired 3 min ago
        escalationCount: 0,
        previouslyNotifiedResponderUids: [],
        createdAt: ts - 300000,
      })
    })

    // Create an available responder in same municipality.
    // responder-1 (currently assigned) must exist and be active or the monitor
    // routes the dispatch to needs_admin instead of escalating.
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'responders', 'responder-1'), {
        availabilityStatus: 'available',
        accountStatus: 'active',
        agencyId: 'bfp',
        municipalityId: 'daet',
        lastSeenAt: ts - 60000,
        fcmTokens: ['token-1'],
      })
      await setDoc(doc(ctx.firestore(), 'responders', 'responder-2'), {
        availabilityStatus: 'available',
        accountStatus: 'active',
        agencyId: 'bfp',
        municipalityId: 'daet',
        lastSeenAt: ts - 60000,
        fcmTokens: ['token-2'],
      })
    })

    await monitorDispatchDeadlinesCore(adminDb, {
      now: ts,
      config: monitorConfig,
    })

    const d1 = await adminDb.collection('dispatches').doc('d1').get()
    const data = d1.data()!
    expect(data.status).toBe('pending')
    expect(data.escalationCount).toBe(1)
    expect(data.assignedTo.uid).toBe('responder-2')
    expect(data.previouslyNotifiedResponderUids).toContain('responder-1')

    // Events
    const events = await adminDb.collection('dispatch_events').get()
    expect(events.size).toBe(2) // deadline_exceeded + escalation_attempted
    const deadlineEvent = events.docs.find((d) => d.data().type === 'deadline_exceeded')
    expect(deadlineEvent?.data().escalationCount).toBe(1)
    const escalationEvent = events.docs.find((d) => d.data().type === 'escalation_attempted')
    expect(escalationEvent?.data().fromResponderUid).toBe('responder-1')
    expect(escalationEvent?.data().toResponderUid).toBe('responder-2')
  })

  itif(available)('flips to needs_admin when escalation cap reached', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
        status: 'pending',
        reportId: 'r1',
        assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        acknowledgementDeadlineAt: ts - 60000,
        monitorLeaseAt: ts - 180000,
        escalationCount: 1,
        previouslyNotifiedResponderUids: ['responder-1'],
        createdAt: ts - 300000,
      })
    })

    await monitorDispatchDeadlinesCore(adminDb, {
      now: ts,
      config: monitorConfig,
    })

    const d1 = await adminDb.collection('dispatches').doc('d1').get()
    const data = d1.data()!
    expect(data.status).toBe('needs_admin')

    const events = await adminDb.collection('dispatch_events').get()
    expect(events.size).toBe(1)
    expect(events.docs[0]!.data().type).toBe('deadline_exceeded')
  })

  itif(available)('counts needs_admin alerts per municipality, not the run total', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      for (const [id, muni] of [
        ['d1', 'daet'],
        ['d2', 'daet'],
        ['d3', 'labo'],
      ] as const) {
        await setDoc(doc(ctx.firestore(), 'dispatches', id), {
          status: 'pending',
          reportId: 'r1',
          assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: muni },
          municipalityId: muni,
          acknowledgementDeadlineAt: ts - 60000,
          monitorLeaseAt: ts - 180000,
          escalationCount: 1,
          previouslyNotifiedResponderUids: ['responder-1'],
          createdAt: ts - 300000,
        })
      }
    })

    await monitorDispatchDeadlinesCore(adminDb, {
      now: ts,
      config: monitorConfig,
    })

    const dateStr = new Date(ts).toISOString().slice(0, 10)
    const daetAlert = await adminDb.collection('alerts').doc('daet_' + dateStr).get()
    const laboAlert = await adminDb.collection('alerts').doc('labo_' + dateStr).get()
    expect(daetAlert.data()?.count).toBe(2)
    expect(laboAlert.data()?.count).toBe(1)
  })

  itif(available)('adds needs_admin alerts to an existing municipality alert count', async () => {
    const dateStr = new Date(ts).toISOString().slice(0, 10)

    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'alerts', 'daet_' + dateStr), {
        type: 'dispatch_deadline_exceeded',
        municipalityId: 'daet',
        count: 5,
        lastUpdatedAt: ts - 1,
      })

      for (const dispatchId of ['d1', 'd2'] as const) {
        await setDoc(doc(ctx.firestore(), 'dispatches', dispatchId), {
          status: 'pending',
          reportId: 'r1',
          assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
          municipalityId: 'daet',
          acknowledgementDeadlineAt: ts - 60000,
          monitorLeaseAt: ts - 180000,
          escalationCount: 1,
          previouslyNotifiedResponderUids: ['responder-1'],
          createdAt: ts - 300000,
        })
      }
    })

    await monitorDispatchDeadlinesCore(adminDb, {
      now: ts,
      config: monitorConfig,
    })

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

  itif(available)('flips to needs_admin when no available responders', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
        status: 'pending',
        reportId: 'r1',
        assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        acknowledgementDeadlineAt: ts - 60000,
        monitorLeaseAt: ts - 180000,
        escalationCount: 0,
        previouslyNotifiedResponderUids: [],
        createdAt: ts - 300000,
      })
    })

    // No responders in DB — should flip to needs_admin

    await monitorDispatchDeadlinesCore(adminDb, {
      now: ts,
      config: monitorConfig,
    })

    const d1 = await adminDb.collection('dispatches').doc('d1').get()
    expect(d1.data()?.status).toBe('needs_admin')
  })

  itif(available)('skips dispatches with unexpired lease', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dispatches', 'd1'), {
        status: 'pending',
        reportId: 'r1',
        assignedTo: { uid: 'responder-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        acknowledgementDeadlineAt: ts - 60000,
        monitorLeaseAt: ts, // lease NOT expired (within 2 min)
        escalationCount: 0,
        previouslyNotifiedResponderUids: [],
        createdAt: ts - 300000,
      })
    })

    await monitorDispatchDeadlinesCore(adminDb, {
      now: ts,
      config: monitorConfig,
    })

    const d1 = await adminDb.collection('dispatches').doc('d1').get()
    expect(d1.data()?.status).toBe('pending') // unchanged
    expect(d1.data()?.escalationCount).toBe(0)
  })
})
