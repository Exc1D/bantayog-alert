/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

vi.mock('firebase-admin/storage', () => ({
  getStorage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      getFiles: vi.fn(() => Promise.resolve([[], []])),
    })),
  })),
}))

import { cancelReportByCitizenCore } from '../../callables/cancel-report-by-citizen.js'
import { seedReportAtStatus, seedActiveAccount } from '../helpers/seed-factories.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'cancel-report-by-citizen-test',
    firestore: { host: 'localhost', port: 8081 },
  })
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('cancelReportByCitizenCore', () => {
  it('deletes report when status is new and citizen owns it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'new', {
        municipalityId: 'daet',
        reporterUid: 'citizen-1',
      })
      await seedActiveAccount(testEnv, {
        uid: 'citizen-1',
        role: 'citizen',
        municipalityId: 'daet',
      })

      const result = await cancelReportByCitizenCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'citizen-1',
          claims: { role: 'citizen' },
        },
        now: Timestamp.now(),
      })

      expect(result.reportId).toBe(reportId)
      const snap = await db.collection('reports').doc(reportId).get()
      expect(snap.exists).toBe(false)
    })
  })

  it('deletes report when status is awaiting_verify and citizen owns it', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
        municipalityId: 'daet',
        reporterUid: 'citizen-1',
      })
      await seedActiveAccount(testEnv, {
        uid: 'citizen-1',
        role: 'citizen',
        municipalityId: 'daet',
      })

      const result = await cancelReportByCitizenCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'citizen-1',
          claims: { role: 'citizen' },
        },
        now: Timestamp.now(),
      })

      expect(result.reportId).toBe(reportId)
      const reportSnap = await db.collection('reports').doc(reportId).get()
      expect(reportSnap.exists).toBe(false)
      const privateSnap = await db.collection('report_private').doc(reportId).get()
      expect(privateSnap.exists).toBe(false)
    })
  })

  it('writes a report_events entry with eventType citizen_cancelled', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'new', {
        municipalityId: 'daet',
        reporterUid: 'citizen-1',
      })
      await seedActiveAccount(testEnv, {
        uid: 'citizen-1',
        role: 'citizen',
        municipalityId: 'daet',
      })

      await cancelReportByCitizenCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'citizen-1',
          claims: { role: 'citizen' },
        },
        now: Timestamp.now(),
      })

      const events = await db.collection('report_events').where('reportId', '==', reportId).get()
      expect(events.docs).toHaveLength(1)
      expect(events.docs[0].data()).toMatchObject({
        from: 'new',
        to: 'citizen_cancelled',
        actor: 'citizen-1',
      })
    })
  })

  it('rejects non-existent report with NOT_FOUND', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedActiveAccount(testEnv, {
        uid: 'citizen-1',
        role: 'citizen',
        municipalityId: 'daet',
      })

      await expect(
        cancelReportByCitizenCore(db, {
          reportId: 'nonexistent-report',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'citizen-1',
            claims: { role: 'citizen' },
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  it('rejects status verified with FAILED_PRECONDITION', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', {
        municipalityId: 'daet',
        reporterUid: 'citizen-1',
      })
      await seedActiveAccount(testEnv, {
        uid: 'citizen-1',
        role: 'citizen',
        municipalityId: 'daet',
      })

      await expect(
        cancelReportByCitizenCore(db, {
          reportId,
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'citizen-1',
            claims: { role: 'citizen' },
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' })
    })
  })

  it('rejects when citizen does not own the report with FORBIDDEN', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'new', {
        municipalityId: 'daet',
        reporterUid: 'citizen-1',
      })
      await seedActiveAccount(testEnv, {
        uid: 'citizen-2',
        role: 'citizen',
        municipalityId: 'daet',
      })

      await expect(
        cancelReportByCitizenCore(db, {
          reportId,
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'citizen-2',
            claims: { role: 'citizen' },
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  it('is idempotent — replay with same key succeeds without error', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'new', {
        municipalityId: 'daet',
        reporterUid: 'citizen-1',
      })
      await seedActiveAccount(testEnv, {
        uid: 'citizen-1',
        role: 'citizen',
        municipalityId: 'daet',
      })

      const key = crypto.randomUUID()

      const first = await cancelReportByCitizenCore(db, {
        reportId,
        idempotencyKey: key,
        actor: {
          uid: 'citizen-1',
          claims: { role: 'citizen' },
        },
        now: Timestamp.now(),
      })
      expect(first.reportId).toBe(reportId)

      const second = await cancelReportByCitizenCore(db, {
        reportId,
        idempotencyKey: key,
        actor: {
          uid: 'citizen-1',
          claims: { role: 'citizen' },
        },
        now: Timestamp.now(),
      })
      expect(second.reportId).toBe(reportId)

      const events = await db.collection('report_events').where('reportId', '==', reportId).get()
      const cancelEvents = events.docs.filter((doc: any) => doc.data().to === 'citizen_cancelled')
      expect(cancelEvents).toHaveLength(1)
    })
  })

  it('also deletes report_contacts and report_lookup when cancelling', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'new', {
        municipalityId: 'daet',
        reporterUid: 'citizen-1',
      })
      await seedActiveAccount(testEnv, {
        uid: 'citizen-1',
        role: 'citizen',
        municipalityId: 'daet',
      })

      await cancelReportByCitizenCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'citizen-1',
          claims: { role: 'citizen' },
        },
        now: Timestamp.now(),
      })

      const contactsSnap = await db.collection('report_contacts').doc(reportId).get()
      expect(contactsSnap.exists).toBe(false)
      const lookupSnap = await db.collection('report_lookup').doc(reportId).get()
      expect(lookupSnap.exists).toBe(false)
    })
  })
})
