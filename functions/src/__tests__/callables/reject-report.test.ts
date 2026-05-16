/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { rejectReportCore } from '../../callables/reject-report.js'
import { seedReportAtStatus, seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'
import { Timestamp } from 'firebase-admin/firestore'

let testEnv: RulesTestEnvironment | undefined
let available = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'reject-report-test',
      firestore: { host: '127.0.0.1', port: 8081 },
    },
    'reject-report',
  )
  testEnv = guarded.env
  available = guarded.available
  if (!available) return
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('rejectReportCore', () => {
  itif(available)(
    'transitions awaiting_verify → cancelled_false_report and writes moderation incident',
    async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
          municipalityId: 'daet',
        })
        await seedActiveAccount(testEnv!, {
          uid: 'admin-1',
          role: 'municipal_admin',
          municipalityId: 'daet',
        })

        const result = await rejectReportCore(db, {
          reportId,
          reason: 'obviously_false',
          notes: 'duplicate from known troll',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        })

        expect(result.status).toBe('cancelled_false_report')
        const report = (await db.collection('reports').doc(reportId).get()).data()
        expect(report.status).toBe('cancelled_false_report')

        const incidents = await db
          .collection('moderation_incidents')
          .where('reportId', '==', reportId)
          .get()
        expect(incidents.docs).toHaveLength(1)
        expect(incidents.docs[0].data()).toMatchObject({
          reportId,
          reason: 'obviously_false',
          notes: 'duplicate from known troll',
          actor: 'admin-1',
        })

        const events = await db.collection('report_events').where('reportId', '==', reportId).get()
        expect(events.docs).toHaveLength(1)
        expect(events.docs[0].data()).toMatchObject({
          from: 'awaiting_verify',
          to: 'cancelled_false_report',
        })
      })
    },
  )

  itif(available)('rejects non-awaiting_verify states with FAILED_PRECONDITION', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })
      await expect(
        rejectReportCore(db, {
          reportId,
          reason: 'obviously_false',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })

  itif(available)('FAILED_PRECONDITION when report is already verified', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })
      await expect(
        rejectReportCore(db, {
          reportId,
          reason: 'insufficient_detail',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })

  itif(available)('rejects cross-muni with FORBIDDEN', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
        municipalityId: 'mercedes',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })
      await expect(
        rejectReportCore(db, {
          reportId,
          reason: 'obviously_false',
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

  itif(available)('allows provincial_superadmin to reject report in any municipality', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
        municipalityId: 'mercedes',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'super-1',
        role: 'provincial_superadmin',
      })

      const result = await rejectReportCore(db, {
        reportId,
        reason: 'obviously_false',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'super-1',
          claims: staffClaims({ role: 'provincial_superadmin' }),
        },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('cancelled_false_report')
      const report = (await db.collection('reports').doc(reportId).get()).data()
      expect(report.status).toBe('cancelled_false_report')
    })
  })
})
