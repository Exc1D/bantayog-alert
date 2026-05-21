/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)
import { Timestamp } from 'firebase-admin/firestore'

vi.mock('firebase-admin/database', () => ({
  getDatabase: vi.fn(() => ({})),
}))

import { closeReportCore } from '../close-report.js'
import {
  seedReportAtStatus,
  seedActiveAccount,
  staffClaims,
} from '../../../__tests__/helpers/seed-factories.js'

let testEnv: RulesTestEnvironment | undefined
let available = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'close-report-test',
      firestore: { host: '127.0.0.1', port: 8081 },
    },
    'close-report',
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

describe('closeReportCore', () => {
  itif(available)('transitions a resolved report to closed', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      const result = await closeReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      expect(result.status).toBe('closed')
      const snap = await db.collection('reports').doc(reportId).get()
      expect(snap.data()?.status).toBe('closed')
    })
  })

  itif(available)('denies admin from another municipality', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-mercedes',
        role: 'municipal_admin',
        municipalityId: 'mercedes',
      })

      await expect(
        closeReportCore(db, {
          reportId,
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-mercedes',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
  })

  itif(available)('rejects close on a non-existent report (NOT_FOUND)', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await expect(
        closeReportCore(db, {
          reportId: 'missing-report-id',
          idempotencyKey: crypto.randomUUID(),
          actor: {
            uid: 'admin-1',
            claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
          },
          now: Timestamp.now(),
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  itif(available)('rejects close on a non-resolved report', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await expect(
        closeReportCore(db, {
          reportId,
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

  itif(available)('appends a report_events entry from:resolved to:closed', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await closeReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      const events = await db
        .collection('report_events')
        .where('reportId', '==', reportId)
        .orderBy('at', 'desc')
        .get()
      const eventData: Record<string, unknown>[] = events.docs.map(
        (doc: any) => doc.data() as Record<string, unknown>,
      )
      const last = eventData[0]
      expect(last).toMatchObject({ from: 'resolved', to: 'closed' })
    })
  })

  itif(available)('stores closureSummary when provided', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      await closeReportCore(db, {
        reportId,
        idempotencyKey: crypto.randomUUID(),
        closureSummary: 'All responders stood down, incident closed.',
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })

      const snap = await db.collection('reports').doc(reportId).get()
      expect(snap.data()?.closureSummary).toBe('All responders stood down, incident closed.')
    })
  })

  itif(available)('is idempotent — replay with same key returns closed without error', async () => {
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { reportId } = await seedReportAtStatus(db, 'resolved', { municipalityId: 'daet' })
      await seedActiveAccount(testEnv!, {
        uid: 'admin-1',
        role: 'municipal_admin',
        municipalityId: 'daet',
      })

      const key = crypto.randomUUID()

      const first = await closeReportCore(db, {
        reportId,
        idempotencyKey: key,
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })
      expect(first.status).toBe('closed')

      // Replay with same key — should succeed (fromCache=true behavior)
      const second = await closeReportCore(db, {
        reportId,
        idempotencyKey: key,
        actor: {
          uid: 'admin-1',
          claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
        },
        now: Timestamp.now(),
      })
      expect(second.status).toBe('closed')

      // Only one event should exist (no duplicate)
      const events = await db.collection('report_events').where('reportId', '==', reportId).get()
      const closeEvents = events.docs.filter((doc: any) => doc.data().to === 'closed')
      expect(closeEvents).toHaveLength(1)
    })
  })
})
