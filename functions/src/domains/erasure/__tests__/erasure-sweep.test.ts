/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)
import { erasureSweepCore } from '../erasure-sweep.js'

const mockUpdateUser = vi.hoisted(() => vi.fn())
const mockDeleteUser = vi.hoisted(() => vi.fn())
const mockGetFiles = vi.hoisted(() => vi.fn().mockResolvedValue([[]]))
const mockDeleteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ updateUser: mockUpdateUser, deleteUser: mockDeleteUser }),
}))
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
vi.mock('../../ops/audit-stream.js', () => ({ streamAuditEvent: vi.fn() }))

let env: RulesTestEnvironment | undefined
let available = false

async function seedApprovedRequest(
  db: any,
  id: string,
  citizenUid: string,
  status = 'approved_pending_anonymization',
  legalHold = false,
) {
  await db.collection('erasure_requests').doc(id).set({
    citizenUid,
    status,
    legalHold,
    requestedAt: Date.now(),
  })
  await db.collection('erasure_active').doc(citizenUid).set({ citizenUid, createdAt: Date.now() })
  // Seed a report and report_private for this citizen
  await db.collection('reports').doc('report-1').set({
    submittedBy: citizenUid,
    verified: false,
    municipalityId: 'daet',
    status: 'pending',
  })
  await db
    .collection('report_private')
    .doc('report-1')
    .set({
      citizenName: 'Juan dela Cruz',
      rawPhone: '+639171234567',
      contactPhone: '+639171234567',
      gpsExact: { lat: 14.1, lng: 122.9 },
      addressText: '123 Main St',
      exactLocation: { lat: 14.123456, lng: 122.987654 },
      reportId: 'report-1',
    })
  await db.collection('report_contacts').doc('report-1').set({
    email: 'juan@example.com',
    phone: '+639171234567',
    reportId: 'report-1',
  })
}

beforeEach(async () => {
  mockUpdateUser.mockReset()
  mockDeleteUser.mockReset()
  mockGetFiles.mockReset()
  mockDeleteFile.mockReset()
  mockUpdateUser.mockResolvedValue(undefined)
  mockDeleteUser.mockResolvedValue(undefined)
  mockGetFiles.mockResolvedValue([[]])
  if (!env) return
  await env.clearFirestore()
})

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'erasure-sweep-test',
      firestore: { host: 'localhost', port: 8081 },
    },
    'erasure-sweep',
  )
  env = guarded.env
  available = guarded.available
  if (!available) return
})

afterAll(async () => {
  await env?.cleanup()
})

describe('erasureSweepCore', () => {
  itif(available)(
    'anonymizes report fields, deletes storage, and deletes Auth on approved request',
    async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        const { getAuth } = await import('firebase-admin/auth')
        const { getStorage } = await import('firebase-admin/storage')
        await seedApprovedRequest(db, 'req-1', 'uid-citizen')

        // Seed two storage files for report-1
        mockGetFiles.mockResolvedValueOnce([
          [
            {
              delete: (): Promise<void> =>
                mockDeleteFile('report_media/report-1/photo1.jpg') as Promise<void>,
            },
            {
              delete: (): Promise<void> =>
                mockDeleteFile('report_media/report-1/photo2.jpg') as Promise<void>,
            },
          ],
        ])

        const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() })
        expect(result.processed).toBe(1)

        // Reports anonymized
        const reportSnap = await db.collection('reports').doc('report-1').get()
        expect(reportSnap.data().submittedBy).toBe('citizen_deleted')
        expect(reportSnap.data().mediaRedacted).toBe(true)

        // report_private PII nulled
        const privateSnap = await db.collection('report_private').doc('report-1').get()
        expect(privateSnap.data().citizenName).toBeNull()
        expect(privateSnap.data().rawPhone).toBeNull()
        expect(privateSnap.data().contactPhone).toBeNull()
        expect(privateSnap.data().exactLocation).toBeNull()

        // report_contacts nulled
        const contactSnap = await db.collection('report_contacts').doc('report-1').get()
        expect(contactSnap.data().email).toBeNull()

        // Auth deleted (last)
        expect(mockDeleteUser).toHaveBeenCalledWith('uid-citizen')

        // Storage cleaned up
        expect(mockGetFiles).toHaveBeenCalledWith({ prefix: 'report_media/report-1/' })
        expect(mockDeleteFile).toHaveBeenCalledWith('report_media/report-1/photo1.jpg')
        expect(mockDeleteFile).toHaveBeenCalledWith('report_media/report-1/photo2.jpg')

        // Sentinel deleted
        const sentinel = await db.collection('erasure_active').doc('uid-citizen').get()
        expect(sentinel.exists).toBe(false)

        // Status completed
        const reqSnap = await db.collection('erasure_requests').doc('req-1').get()
        expect(reqSnap.data().status).toBe('completed')
      })
    },
  )

  itif(available)('skips records with legalHold === true', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      const { getStorage } = await import('firebase-admin/storage')
      await seedApprovedRequest(db, 'req-held', 'uid-held', 'approved_pending_anonymization', true)

      const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() })
      expect(result.processed).toBe(0)
      expect(result.skippedHeld).toBe(1)
      expect(mockDeleteUser).not.toHaveBeenCalled()
    })
  })

  itif(available)('skips reports with no submittedBy (pseudonymous)', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      const { getStorage } = await import('firebase-admin/storage')
      await seedApprovedRequest(db, 'req-pseudo', 'uid-pseudo')
      // Add a pseudonymous report (no submittedBy matching uid)
      await db.collection('reports').doc('pseudo-report').set({
        municipalityId: 'daet',
        status: 'pending',
        verified: false,
      })

      const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() })
      expect(result.processed).toBe(1)
      // pseudo-report is not touched
      const pseudoSnap = await db.collection('reports').doc('pseudo-report').get()
      expect(pseudoSnap.data().submittedBy).toBeUndefined()
    })
  })

  itif(available)(
    'dead-letters and re-enables Auth on erasure failure when re-enable succeeds',
    async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        const { getAuth } = await import('firebase-admin/auth')
        const { getStorage } = await import('firebase-admin/storage')
        await seedApprovedRequest(db, 'req-fail', 'uid-fail')
        // Force Auth delete to throw
        mockDeleteUser.mockRejectedValueOnce(new Error('auth error'))

        const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() })
        expect(result.deadLettered).toBe(1)

        const reqSnap = await db.collection('erasure_requests').doc('req-fail').get()
        expect(reqSnap.data().status).toBe('dead_lettered')
        expect(reqSnap.data().deadLetterReason).toContain('auth error')
        // Auth re-enable was attempted
        expect(mockUpdateUser).toHaveBeenCalledWith('uid-fail', { disabled: false })
      })
    },
  )

  itif(available)(
    'throws and dead-letters when Auth re-enable fails after erasure failure',
    async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore() as any
        const { getAuth } = await import('firebase-admin/auth')
        const { getStorage } = await import('firebase-admin/storage')
        await seedApprovedRequest(db, 'req-dual-fail', 'uid-dual-fail')
        mockDeleteUser.mockRejectedValueOnce(new Error('auth error'))
        mockUpdateUser.mockRejectedValueOnce(new Error('re-enable failed'))

        await expect(
          erasureSweepCore({ db, auth: getAuth(), storage: getStorage() }),
        ).rejects.toThrow('re-enable failed')

        const reqSnap = await db.collection('erasure_requests').doc('req-dual-fail').get()
        expect(reqSnap.data().status).toBe('dead_lettered')
        expect(reqSnap.data().deadLetterReason).toContain('auth error')
        expect(reqSnap.data().deadLetterReason).toContain('re-enable failed')
        // Auth re-enable was attempted
        expect(mockUpdateUser).toHaveBeenCalledWith('uid-dual-fail', { disabled: false })
      })
    },
  )

  itif(available)('re-claims stale executing record (>30min) with new sweepRunId', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      const { getStorage } = await import('firebase-admin/storage')
      const staleAt = Date.now() - 31 * 60 * 1000
      await db
        .collection('erasure_requests')
        .doc('req-stale')
        .set({
          citizenUid: 'uid-stale',
          status: 'executing',
          legalHold: false,
          sweepRunId: 'old-run-id',
          executionStartedAt: staleAt,
          requestedAt: staleAt - 1000,
        })
      await db
        .collection('erasure_active')
        .doc('uid-stale')
        .set({ citizenUid: 'uid-stale', createdAt: staleAt })

      const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() })
      expect(result.processed).toBe(1)

      const reqSnap = await db.collection('erasure_requests').doc('req-stale').get()
      expect(reqSnap.data().sweepRunId).not.toBe('old-run-id')
      expect(reqSnap.data().status).toBe('completed')
    })
  })

  // Gap 4: claim_lost_race throw path
  itif(available)('throws claim_lost_race when record is no longer eligible', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      const { getStorage } = await import('firebase-admin/storage')
      await seedApprovedRequest(db, 'req-race', 'uid-race')

      const baseNow = Date.now()
      // Make the record stale for the query (31 min ago)
      await db
        .collection('erasure_requests')
        .doc('req-race')
        .update({
          status: 'executing',
          executionStartedAt: baseNow - 31 * 60 * 1000,
        })

      // Simulate TOCTOU race: record is stale at query time but no longer stale
      // inside the transaction (now() returns a smaller value).
      let callCount = 0
      const mockNow = () => {
        callCount++
        // Call 1: staleSnap threshold (record is stale)
        // Calls 2+: transaction time (record is no longer stale → claim_lost_race)
        return callCount === 1 ? baseNow : baseNow - 2 * 60 * 1000
      }

      await expect(
        erasureSweepCore({ db, auth: getAuth(), storage: getStorage(), now: mockNow }),
      ).rejects.toThrow('claim_lost_race')
    })
  })

  // Gap 5: deadLettered count on failure
  itif(available)('dead-letters a request when deleteUser fails', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      const { getStorage } = await import('firebase-admin/storage')
      await seedApprovedRequest(db, 'req-dead', 'uid-dead')
      mockDeleteUser.mockRejectedValueOnce(new Error('auth delete failed'))

      const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() })
      expect(result.deadLettered).toBe(1)
      expect(result.processed).toBe(0)

      const reqSnap = await db.collection('erasure_requests').doc('req-dead').get()
      expect(reqSnap.data().status).toBe('dead_lettered')
      expect(reqSnap.data().deadLetterReason).toContain('auth delete failed')
    })
  })
})
