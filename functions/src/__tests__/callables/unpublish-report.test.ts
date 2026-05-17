/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'
import { guardInitTestEnvironment } from '../helpers/emulator-guard.js'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { unpublishReportCore } from '../../callables/unpublish-report.js'
import { seedActiveAccount, seedReportAtStatus, staffClaims } from '../helpers/seed-factories.js'

let testEnv: RulesTestEnvironment | undefined
let available = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'unpublish-report-test',
      firestore: { host: '127.0.0.1', port: 8081 },
    },
    'unpublish-report',
  )
  testEnv = guarded.env
  available = guarded.available
})

beforeEach(async () => {
  if (!available || !testEnv) return
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv?.cleanup()
})

describe('unpublishReportCore', () => {
  it('hides a public report and records moderation/audit evidence', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await db.collection('reports').doc(reportId).update({
        visibilityClass: 'public_alertable',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      const result = await unpublishReportCore(db, {
        reportId,
        reason: 'sensitive_content',
        notes: 'contains private home details',
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      expect(result.visibilityClass).toBe('internal')
      const report = (await db.collection('reports').doc(reportId).get()).data()
      expect(report.visibilityClass).toBe('internal')
      expect(report.unpublishReason).toBe('sensitive_content')

      const incidents = await db
        .collection('moderation_incidents')
        .where('reportId', '==', reportId)
        .get()
      expect(incidents.docs).toHaveLength(1)
      expect(incidents.docs[0].data()).toMatchObject({
        reportId,
        reason: 'sensitive_content',
        notes: 'contains private home details',
        actor: 'admin-1',
        action: 'unpublish',
      })

      const events = await db.collection('report_events').where('reportId', '==', reportId).get()
      expect(events.docs).toHaveLength(1)
      expect(events.docs[0].data()).toMatchObject({
        eventType: 'report_unpublished',
        fromVisibilityClass: 'public_alertable',
        toVisibilityClass: 'internal',
      })
    })
  })

  it('rejects cross-municipality takedowns by municipal admins', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'labo' })
      await db.collection('reports').doc(reportId).update({
        visibilityClass: 'public_alertable',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await expect(
        unpublishReportCore(db, {
          reportId,
          reason: 'sensitive_content',
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

  it('rejects reports that are not currently public', async ({ skip }) => {
    if (!available || !testEnv) skip()
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await db.collection('reports').doc(reportId).update({
        visibilityClass: 'internal',
      })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await expect(
        unpublishReportCore(db, {
          reportId,
          reason: 'sensitive_content',
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
})
