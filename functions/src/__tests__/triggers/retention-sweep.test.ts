/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { retentionSweepCore } from '../../triggers/retention-sweep.js'

const mockGetFiles = vi.fn().mockResolvedValue([[]])
const mockDeleteFile = vi.fn().mockResolvedValue(undefined)

vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      getFiles: mockGetFiles,
      file: (path: string) => ({
        delete: (): Promise<void> => mockDeleteFile(path) as Promise<void>,
      }),
    }),
  }),
}))
vi.mock('../../services/audit-stream.js', () => ({ streamAuditEvent: vi.fn() }))

let env: RulesTestEnvironment | undefined

beforeEach(async () => {
  mockGetFiles.mockResolvedValue([[]])
  env = await initializeTestEnvironment({
    projectId: 'demo-8c-retention',
    firestore: { host: 'localhost', port: 8081 },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const col of ['reports', 'report_private', 'report_contacts', 'erasure_requests']) {
      const snap = await db.collection(col).get()
      await Promise.all(snap.docs.map((d) => d.ref.delete()))
    }
  })
})

afterEach(async () => {
  await env?.cleanup()
})

describe('retentionSweepCore', () => {
  it('anonymizes unverified report older than 1 week and sets retentionHardDeleteEligibleAt', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getStorage } = await import('firebase-admin/storage')
      const oldSubmittedAt = Date.now() - 8 * 24 * 60 * 60 * 1000

      await db.collection('reports').doc('r-old').set({
        submittedBy: 'uid-anon',
        verified: false,
        submittedAt: oldSubmittedAt,
        municipalityId: 'daet',
      })
      await db
        .collection('report_private')
        .doc('r-old')
        .set({
          citizenName: 'Test User',
          rawPhone: '+63917',
          gpsExact: { lat: 14.1, lng: 122.9 },
          addressText: '123 St',
          reportId: 'r-old',
        })

      const result = await retentionSweepCore({ db, storage: getStorage() })
      expect(result.anonymized).toBe(1)

      const privSnap = await db.collection('report_private').doc('r-old').get()
      expect(privSnap.data().citizenName).toBeNull()

      const reportSnap = await db.collection('reports').doc('r-old').get()
      expect(reportSnap.data().retentionAnonymizedAt).toBeDefined()
      expect(reportSnap.data().retentionHardDeleteEligibleAt).toBeGreaterThan(Date.now())
    })
  })

  it('skips reports where submittedBy === citizen_deleted', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getStorage } = await import('firebase-admin/storage')
      const oldSubmittedAt = Date.now() - 8 * 24 * 60 * 60 * 1000

      await db.collection('reports').doc('r-erased').set({
        submittedBy: 'citizen_deleted',
        verified: false,
        submittedAt: oldSubmittedAt,
        municipalityId: 'daet',
      })
      const result = await retentionSweepCore({ db, storage: getStorage() })
      expect(result.anonymized).toBe(0)

      const reportSnap = await db.collection('reports').doc('r-erased').get()
      expect(reportSnap.data().retentionAnonymizedAt).toBeUndefined()
    })
  })

  it('skips reports belonging to citizen with active erasure request', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getStorage } = await import('firebase-admin/storage')
      const oldAt = Date.now() - 8 * 24 * 60 * 60 * 1000

      await db.collection('reports').doc('r-active').set({
        submittedBy: 'uid-active',
        verified: false,
        submittedAt: oldAt,
        municipalityId: 'daet',
      })
      // Seed an active erasure request for this citizen
      await db.collection('erasure_requests').doc('req-active').set({
        citizenUid: 'uid-active',
        status: 'executing',
        requestedAt: oldAt,
      })

      const result = await retentionSweepCore({ db, storage: getStorage() })
      expect(result.anonymized).toBe(0)

      // Verify in-memory check excluded the report
      const reportSnap = await db.collection('reports').doc('r-active').get()
      expect(reportSnap.data().retentionAnonymizedAt).toBeUndefined()
    })
  })

  it('hard-deletes report when retentionHardDeleteEligibleAt is in the past', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getStorage } = await import('firebase-admin/storage')
      const pastEligible = Date.now() - 1000

      await db
        .collection('reports')
        .doc('r-delete')
        .set({
          submittedBy: 'uid-old',
          verified: false,
          submittedAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
          retentionAnonymizedAt: pastEligible - 30 * 24 * 60 * 60 * 1000,
          retentionHardDeleteEligibleAt: pastEligible,
          municipalityId: 'daet',
        })
      await db.collection('report_private').doc('r-delete').set({ reportId: 'r-delete' })
      await db.collection('report_contacts').doc('r-delete').set({ reportId: 'r-delete' })

      const result = await retentionSweepCore({ db, storage: getStorage() })
      expect(result.hardDeleted).toBe(1)

      const reportSnap = await db.collection('reports').doc('r-delete').get()
      expect(reportSnap.exists).toBe(false)

      const privSnap = await db.collection('report_private').doc('r-delete').get()
      expect(privSnap.exists).toBe(false)
    })
  })
})
