import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { rejectReportCore } from '../reject-report.js'
import {
  seedReportAtStatus,
  seedActiveAccount,
  staffClaims,
} from '../../../__tests__/helpers/seed-factories.js'
import { type Firestore, Timestamp } from 'firebase-admin/firestore'

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
  it('transitions awaiting_verify → cancelled_false_report and writes moderation incident', async ({
    skip,
  }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
        municipalityId: 'daet',
      })
      await seedActiveAccount(env, {
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
      const reportSnap = await db.collection('reports').doc(reportId).get()
      const report = reportSnap.data()!
      expect(report.status).toBe('cancelled_false_report')

      const incidents = await db
        .collection('moderation_incidents')
        .where('reportId', '==', reportId)
        .get()
      expect(incidents.docs).toHaveLength(1)
      expect(incidents.docs[0]!.data()).toMatchObject({
        reportId,
        reason: 'obviously_false',
        notes: 'duplicate from known troll',
        actor: 'admin-1',
      })

      const events = await db.collection('report_events').where('reportId', '==', reportId).get()
      const eventData = events.docs.map((doc: { data: () => Record<string, unknown> }) =>
        doc.data(),
      )
      expect(
        eventData.filter((event: Record<string, unknown>) => event.to === 'cancelled_false_report'),
      ).toHaveLength(1)
      expect(eventData).toContainEqual(
        expect.objectContaining({
          from: 'awaiting_verify',
          to: 'cancelled_false_report',
        }),
      )
      const notificationEvents = eventData.filter(
        (event: Record<string, unknown>) => event.type === 'notification_attempted',
      )
      expect(notificationEvents).toHaveLength(1)
      expect(notificationEvents[0]).toMatchObject({
        reportId,
        channel: 'push',
        audience: 'citizen',
        fcmResult: 'no_token',
        fcmWarnings: ['fcm_no_token'],
        schemaVersion: 1,
      })
    })
  })

  it('rejects non-awaiting_verify states with FAILED_PRECONDITION', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' })
      await seedActiveAccount(env, {
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

  it('FAILED_PRECONDITION when report is already verified', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedActiveAccount(env, {
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

  it('rejects cross-muni with FORBIDDEN', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
        municipalityId: 'mercedes',
      })
      await seedActiveAccount(env, {
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

  it('allows provincial_superadmin to reject report in any municipality', async ({ skip }) => {
    const env = testEnv
    if (!available || !env) return skip('Firestore emulator unavailable')

    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
        municipalityId: 'mercedes',
      })
      await seedActiveAccount(env, {
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
      const reportSnap = await db.collection('reports').doc(reportId).get()
      const report = reportSnap.data()!
      expect(report.status).toBe('cancelled_false_report')
    })
  })
})
