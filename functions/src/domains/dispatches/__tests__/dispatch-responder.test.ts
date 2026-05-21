/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)

// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { dispatchResponderCore } from '../dispatch-responder.js'
import {
  seedReportAtStatus,
  seedActiveAccount,
  seedResponderDoc,
  seedResponderShift,
  staffClaims,
} from '../../../__tests__/helpers/seed-factories.js'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment | undefined
let available = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'dispatch-responder-test',
      firestore: { host: 'localhost', port: 8081 },
      database: { host: 'localhost', port: 9000 },
    },
    'dispatch-responder',
  )
  testEnv = guarded.env
  available = guarded.available
  if (!available) return
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
  // clearDatabase hangs when the RTDB emulator is not running.
  await Promise.race([
    testEnv.clearDatabase(),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('clearDatabase timeout'))
      }, 2000)
    }),
  ]).catch((err: unknown) => {
    if (err instanceof Error && err.message !== 'clearDatabase timeout') {
      console.warn('[beforeEach] clearDatabase failed:', err.message)
    }
  })
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('dispatchResponderCore', () => {
  itif(available)(
    'creates dispatch, transitions report → assigned, writes both event streams',
    async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        const rtdb = testEnv!.unauthenticatedContext().database() as any

        const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
        await seedActiveAccount(testEnv!, {
          uid: 'admin-1',
          role: 'municipal_admin',
          municipalityId: 'daet',
        })

        await seedResponderDoc(db, {
          uid: 'r1',
          municipalityId: 'daet',
          agencyId: 'bfp-daet',
          isActive: true,
        })
        await seedResponderShift(rtdb, 'daet', 'r1', true)

        const result = await dispatchResponderCore(db, rtdb, {
          reportId,
          responderUid: 'r1',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        })

        expect(result.status).toBe('pending')
        expect(result.dispatchId).toBeDefined()

        const dispatch = (await db.collection('dispatches').doc(result.dispatchId).get()).data()
        expect(dispatch).toMatchObject({
          dispatchId: result.dispatchId,
          reportId,
          status: 'pending',
          municipalityId: 'daet',
          assignedTo: { uid: 'r1', agencyId: 'bfp-daet', municipalityId: 'daet' },
          dispatchedBy: 'admin-1',
          dispatchedByRole: 'municipal_admin',
          schemaVersion: 1,
        })
        expect(dispatch.dispatchedAt).toBeDefined()
        expect(dispatch.statusUpdatedAt).toBe(dispatch.dispatchedAt)
        expect(dispatch.lastStatusAt).toBe(dispatch.dispatchedAt)
        expect(dispatch.acknowledgementDeadlineAt - dispatch.dispatchedAt).toBe(5 * 60 * 1000)
        expect(dispatch.idempotencyKey).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        )
        expect(dispatch.idempotencyPayloadHash).toMatch(/^[0-9a-f]{64}$/)

        const report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('assigned')

        const reportEvents = await db
          .collection('report_events')
          .where('reportId', '==', reportId)
          .get()
        expect(reportEvents.docs).toHaveLength(1)
        const dispatchEvents = await db
          .collection('dispatch_events')
          .where('dispatchId', '==', result.dispatchId)
          .get()
        expect(dispatchEvents.docs).toHaveLength(1)
      })
    },
  )

  itif(available)('sets acknowledgementDeadlineAt according to severity', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const rtdb = testEnv!.unauthenticatedContext().database() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', {
        municipalityId: 'daet',
        severity: 'high',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await seedResponderDoc(db, {
        uid: 'r1',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
      await seedResponderShift(rtdb, 'daet', 'r1', true)
      const now = Timestamp.now()
      const result = await dispatchResponderCore(db, rtdb, {
        reportId,
        responderUid: 'r1',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now,
      })
      const dispatch = (await db.collection('dispatches').doc(result.dispatchId).get()).data()
      expect(dispatch.acknowledgementDeadlineAt - now.toMillis()).toBeCloseTo(5 * 60 * 1000, -3)
    })
  })
})

describe('dispatchResponderCore error paths', () => {
  itif(available)('PERMISSION_DENIED when responder is in another municipality', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const rtdb = testEnv!.unauthenticatedContext().database() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await seedResponderDoc(db, {
        uid: 'r-wrong-muni',
        municipalityId: 'mercedes',
        agencyId: 'bfp-mercedes',
        isActive: true,
      })
      await seedResponderShift(rtdb, 'mercedes', 'r-wrong-muni', true)
      await expect(
        dispatchResponderCore(db, rtdb, {
          reportId,
          responderUid: 'r-wrong-muni',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  itif(available)('INVALID_STATUS_TRANSITION when report is not verified', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const rtdb = testEnv!.unauthenticatedContext().database() as any
      const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await seedResponderDoc(db, {
        uid: 'r1',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
      await seedResponderShift(rtdb, 'daet', 'r1', true)
      await expect(
        dispatchResponderCore(db, rtdb, {
          reportId,
          responderUid: 'r1',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
    })
  })

  itif(available)('INVALID_STATUS_TRANSITION when responder is not on shift', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const rtdb = testEnv!.unauthenticatedContext().database() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await seedResponderDoc(db, {
        uid: 'r1',
        municipalityId: 'daet',
        agencyId: 'bfp-daet',
        isActive: true,
      })
      await seedResponderShift(rtdb, 'daet', 'r1', false)
      await expect(
        dispatchResponderCore(db, rtdb, {
          reportId,
          responderUid: 'r1',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' })
    })
  })
})
