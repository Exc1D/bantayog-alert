/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)

// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

vi.mock('../../ops/fcm-send.js', () => ({
  sendFcmToResponder: vi.fn().mockResolvedValue({ warnings: [] }),
}))

import { escalateDispatchCore } from '../escalate-dispatch.js'
import { sendFcmToResponder } from '../../ops/fcm-send.js'
import { seedActiveAccount, staffClaims } from '../../../__tests__/helpers/seed-factories.js'
import { Timestamp } from 'firebase-admin/firestore'

const guarded = await guardInitTestEnvironment(
  {
    projectId: 'escalate-dispatch-test',
    firestore: { host: 'localhost', port: 8081 },
  },
  'escalate-dispatch',
)
const testEnv: RulesTestEnvironment | undefined = guarded.env
const available = guarded.available

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv!.clearFirestore()
})
afterAll(async () => {
  await testEnv?.cleanup()
})

const ts = 1713350400000

async function seedResponder(db: any, uid: string, muni: string, status: 'active' | 'suspended') {
  await db.collection('responders').doc(uid).set({
    uid,
    municipalityId: muni,
    agencyId: 'bfp',
    accountStatus: status,
    availabilityStatus: 'available',
    lastSeenAt: ts,
  })
}

async function seedDispatchNeedsAdmin(
  db: any,
  dispatchId: string,
  opts: { municipalityId: string; responderUid: string },
) {
  await db
    .collection('dispatches')
    .doc(dispatchId)
    .set({
      reportId: 'r1',
      status: 'needs_admin',
      assignedTo: {
        uid: opts.responderUid,
        agencyId: 'bfp',
        municipalityId: opts.municipalityId,
      },
      municipalityId: opts.municipalityId,
      escalationCount: 1,
      previouslyNotifiedResponderUids: [opts.responderUid],
      acknowledgementDeadlineAt: ts + 900000,
      monitorLeaseAt: ts,
      dispatchedAt: ts,
      lastStatusAt: ts,
      correlationId: crypto.randomUUID(),
      schemaVersion: 1,
    })
}

async function seedDispatchNeedsAdminNoAssignedTo(
  db: any,
  dispatchId: string,
  opts: { municipalityId: string },
) {
  await db
    .collection('dispatches')
    .doc(dispatchId)
    .set({
      reportId: 'r1',
      status: 'needs_admin',
      municipalityId: opts.municipalityId,
      escalationCount: 0,
      previouslyNotifiedResponderUids: [],
      acknowledgementDeadlineAt: ts + 900000,
      monitorLeaseAt: ts,
      dispatchedAt: ts,
      lastStatusAt: ts,
      correlationId: crypto.randomUUID(),
      schemaVersion: 1,
    })
}

describe('escalateDispatchCore', () => {
  itif(available)('allows municipal_admin to escalate dispatch in their municipality', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedResponder(db, 'responder-1', 'daet', 'active')
      await seedResponder(db, 'responder-2', 'daet', 'active')
      await seedDispatchNeedsAdmin(db, 'd1', {
        municipalityId: 'daet',
        responderUid: 'responder-1',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      const result = await escalateDispatchCore(db, {
        dispatchId: 'd1',
        newResponderUid: 'responder-2',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('pending')
      expect(result.dispatchId).toBe('d1')

      const dispatch = (await db.collection('dispatches').doc('d1').get()).data()!
      expect(dispatch.status).toBe('pending')
      expect(dispatch.escalationCount).toBe(2)
      expect(dispatch.assignedTo.uid).toBe('responder-2')
      expect(dispatch.previouslyNotifiedResponderUids).toContain('responder-1')
      expect(dispatch.escalationReason).toBe('admin_override')

      const events = await db.collection('dispatch_events').get()
      const escalationEvent = events.docs.find((d: any) => d.data().type === 'escalation_attempted')
      expect(escalationEvent).toBeDefined()
      expect(escalationEvent!.data().fromResponderUid).toBe('responder-1')
      expect(escalationEvent!.data().toResponderUid).toBe('responder-2')
      expect(escalationEvent!.data().reason).toBe('admin_override')

      expect(sendFcmToResponder).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'responder-2',
          title: 'Dispatch escalated',
        }),
      )

      const notificationEvent = events.docs.find(
        (d: any) => d.data().type === 'notification_attempted',
      )
      expect(notificationEvent).toBeDefined()
      expect(notificationEvent!.data().fcmResult).toBe('sent')

      const dispatchDoc = (await db.collection('dispatches').doc('d1').get()).data()!
      expect(dispatchDoc.fcmResult).toBe('sent')
    })
  })

  itif(available)('rejects municipal_admin escalating dispatch in other municipality', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedResponder(db, 'responder-1', ' OTHER: ', 'active')
      await seedResponder(db, 'responder-2', ' OTHER: ', 'active')
      await seedDispatchNeedsAdmin(db, 'd1', {
        municipalityId: ' OTHER: ',
        responderUid: 'responder-1',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await expect(
        escalateDispatchCore(db, {
          dispatchId: 'd1',
          newResponderUid: 'responder-2',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toThrow('not your municipality')
    })
  })

  itif(available)('allows provincial_superadmin to escalate any dispatch', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedResponder(db, 'responder-1', ' OTHER: ', 'active')
      await seedResponder(db, 'responder-2', ' OTHER: ', 'active')
      await seedDispatchNeedsAdmin(db, 'd1', {
        municipalityId: ' OTHER: ',
        responderUid: 'responder-1',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'superadmin-1',
        role: 'provincial_superadmin',
      })

      const result = await escalateDispatchCore(db, {
        dispatchId: 'd1',
        newResponderUid: 'responder-2',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'superadmin-1',
          claims: staffClaims({ role: 'provincial_superadmin' }),
        },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('pending')
    })
  })

  itif(available)('rejects escalating to already-notified responder', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedResponder(db, 'responder-1', 'daet', 'active')
      await seedDispatchNeedsAdmin(db, 'd1', {
        municipalityId: 'daet',
        responderUid: 'responder-1',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await expect(
        escalateDispatchCore(db, {
          dispatchId: 'd1',
          newResponderUid: 'responder-1',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toThrow('already notified')
    })
  })

  itif(available)(
    'does not add newResponderUid to previouslyNotified when assignedTo is missing',
    async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        await seedResponder(db, 'responder-2', 'daet', 'active')
        await seedDispatchNeedsAdminNoAssignedTo(db, 'd1', { municipalityId: 'daet' })
        await seedActiveAccount(testEnv!, {
          uid: 'admin-1',
          role: 'municipal_admin',
          municipalityId: 'daet',
        })

        const result = await escalateDispatchCore(db, {
          dispatchId: 'd1',
          newResponderUid: 'responder-2',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        })

        expect(result.status).toBe('pending')
        const dispatch = (await db.collection('dispatches').doc('d1').get()).data()!
        expect(dispatch.assignedTo.uid).toBe('responder-2')
        expect(dispatch.previouslyNotifiedResponderUids).not.toContain('responder-2')
        expect(dispatch.escalationCount).toBe(1)
      })
    },
  )
})
