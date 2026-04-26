import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

const { onCallMock } = vi.hoisted(() => ({
  onCallMock: vi.fn((_config: unknown, handler: unknown) => handler),
}))

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<typeof import('firebase-functions/v2/https')>(
    'firebase-functions/v2/https',
  )
  return {
    ...actual,
    onCall: onCallMock,
  }
})

let adminDb: Firestore
vi.mock('../../admin-init.js', () => ({
  get adminDb() {
    return adminDb
  },
}))

import { triggerSOS, triggerSosCore } from '../../callables/trigger-sos.js'
import { seedActiveAccount } from '../helpers/seed-factories.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'trigger-sos-test',
    firestore: {
      host: 'localhost',
      port: 8081,
      rules:
        'rules_version = "2"; service cloud.firestore { match /{d=**} { allow read, write: if true; } }',
    },
  })
  adminDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

async function seedDispatchActive(
  env: RulesTestEnvironment,
  dispatchId: string,
  reportId: string,
  responderUid: string,
  status: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db
      .collection('dispatches')
      .doc(dispatchId)
      .set({
        dispatchId,
        reportId,
        status,
        assignedTo: {
          uid: responderUid,
          agencyId: 'bfp-daet',
          municipalityId: 'daet',
        },
        dispatchedAt: Date.now(),
        lastStatusAt: Date.now(),
        schemaVersion: 1,
        ...overrides,
      })
  })
}

describe('triggerSosCore', () => {
  it('sets sosTriggeredAt for an active dispatch', async () => {
    await seedDispatchActive(testEnv, 'dispatch-1', 'report-1', 'r1', 'on_scene')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const result = await triggerSosCore(db, {
        dispatchId: 'dispatch-1',
        actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('sos_triggered')

      const dispatch = (await db.collection('dispatches').doc('dispatch-1').get()).data()
      expect(dispatch?.sosTriggeredAt).toBeDefined()

      const notifications = await db
        .collection('admin_notifications')
        .where('type', '==', 'sos_triggered')
        .get()
      expect(notifications.docs).toHaveLength(1)
    })
  })

  it('rejects when SOS already triggered (rate limit)', async () => {
    await seedDispatchActive(testEnv, 'dispatch-2', 'report-2', 'r1', 'on_scene', {
      sosTriggeredAt: Date.now(),
    })
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        triggerSosCore(db, {
          dispatchId: 'dispatch-2',
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })

  it('rejects when dispatch is not active', async () => {
    await seedDispatchActive(testEnv, 'dispatch-3', 'report-3', 'r1', 'pending')
    await seedActiveAccount(testEnv, {
      uid: 'r1',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        triggerSosCore(db, {
          dispatchId: 'dispatch-3',
          actor: { uid: 'r1', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })

  it('rejects when caller is not the assigned responder', async () => {
    await seedDispatchActive(testEnv, 'dispatch-4', 'report-4', 'r1', 'on_scene')
    await seedActiveAccount(testEnv, {
      uid: 'r2',
      role: 'responder',
      municipalityId: 'daet',
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      await expect(
        triggerSosCore(db, {
          dispatchId: 'dispatch-4',
          actor: { uid: 'r2', claims: { role: 'responder', municipalityId: 'daet' } },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })
})

describe('triggerSOS callable', () => {
  const callCallable = triggerSOS as unknown as (request: {
    auth?: { uid: string; token: { role: string; accountStatus: 'active' } }
    data: { dispatchId: string }
  }) => Promise<{ status: 'sos_triggered'; dispatchId: string }>

  it('rejects unauthenticated request', async () => {
    await expect(
      callCallable({
        data: { dispatchId: 'dispatch-x' },
      }),
    ).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('rejects wrong-role request', async () => {
    await expect(
      callCallable({
        auth: {
          uid: 'admin-1',
          token: { role: 'municipal_admin', accountStatus: 'active' },
        },
        data: { dispatchId: 'dispatch-x' },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' })
  })
})
