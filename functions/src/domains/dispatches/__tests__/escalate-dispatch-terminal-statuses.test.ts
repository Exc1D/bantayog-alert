/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
import { seedActiveAccount, staffClaims } from '../../../__tests__/helpers/seed-factories.js'

const itif = (condition: boolean) => (condition ? it : it.skip)

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

vi.mock('../../ops/fcm-send.js', () => ({
  sendFcmToResponder: vi.fn().mockResolvedValue({ warnings: [] }),
}))

import { escalateDispatchCore } from '../escalate-dispatch.js'
import { sendFcmToResponder } from '../../ops/fcm-send.js'

const guarded = await guardInitTestEnvironment(
  {
    projectId: 'escalate-dispatch-terminal-statuses-test',
    firestore: { host: 'localhost', port: 8081 },
  },
  'escalate-dispatch-terminal-statuses',
)
const testEnv: RulesTestEnvironment | undefined = guarded.env
const available = guarded.available

const ts = 1713350400000
const terminalStatuses = ['resolved', 'cancelled', 'superseded'] as const

type TerminalDispatchStatus = (typeof terminalStatuses)[number]

beforeEach(async () => {
  vi.clearAllMocks()
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv?.cleanup()
})

async function seedResponder(db: any, uid: string, municipalityId: string) {
  await db.collection('responders').doc(uid).set({
    uid,
    municipalityId,
    agencyId: 'bfp',
    accountStatus: 'active',
    availabilityStatus: 'available',
    lastSeenAt: ts,
  })
}

async function seedDispatch(db: any, status: TerminalDispatchStatus) {
  await db.collection('dispatches').doc('d1').set({
    reportId: 'r1',
    status,
    assignedTo: {
      uid: 'responder-1',
      agencyId: 'bfp',
      municipalityId: 'daet',
    },
    municipalityId: 'daet',
    escalationCount: 1,
    previouslyNotifiedResponderUids: ['responder-1'],
    acknowledgementDeadlineAt: ts + 900000,
    monitorLeaseAt: ts,
    dispatchedAt: ts,
    lastStatusAt: ts,
    correlationId: crypto.randomUUID(),
    schemaVersion: 1,
  })
}

describe('escalateDispatchCore terminal-status guard', () => {
  for (const status of terminalStatuses) {
    itif(available)('rejects escalating a ' + status + ' dispatch', async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        await seedResponder(db, 'responder-1', 'daet')
        await seedResponder(db, 'responder-2', 'daet')
        await seedDispatch(db, status)
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
        ).rejects.toThrow('cannot escalate a ' + status + ' dispatch')
      })
    })
  }

  itif(available)('does not notify responders when terminal escalation is rejected', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedResponder(db, 'responder-1', 'daet')
      await seedResponder(db, 'responder-2', 'daet')
      await seedDispatch(db, 'superseded')
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
      ).rejects.toThrow('cannot escalate a superseded dispatch')

      expect(sendFcmToResponder).not.toHaveBeenCalled()
    })
  })
})
