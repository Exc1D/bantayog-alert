/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
import { requestDataErasureCore } from '../request-data-erasure.js'

const { mockUpdateUser } = vi.hoisted(() => ({ mockUpdateUser: vi.fn() }))
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ updateUser: mockUpdateUser }),
}))
vi.mock('../../ops/audit-stream.js', () => ({ streamAuditEvent: vi.fn() }))

const guarded = await guardInitTestEnvironment(
  {
    projectId: 'demo-8c-erasure',
    firestore: { host: 'localhost', port: 8081 },
  },
  'request-data-erasure',
)
const env: RulesTestEnvironment | undefined = guarded.env
const available = guarded.available

const itif = (condition: boolean) => (condition ? it : it.skip)

beforeEach(async () => {
  mockUpdateUser.mockReset()
  mockUpdateUser.mockResolvedValue(undefined)
  if (!env) return
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const col of ['erasure_requests', 'erasure_active']) {
      const snap = await db.collection(col).get()
      await Promise.all(snap.docs.map((d) => d.ref.delete()))
    }
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('requestDataErasureCore', () => {
  itif(available)('creates erasure_requests doc and sentinel, then disables Auth', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      await requestDataErasureCore(db, getAuth(), { uid: 'user-1' })
      const reqSnap = await db
        .collection('erasure_requests')
        .where('citizenUid', '==', 'user-1')
        .get()
      expect(reqSnap.docs).toHaveLength(1)
      expect(reqSnap.docs[0]?.data().status).toBe('pending_review')
      expect(reqSnap.docs[0]?.data().legalHold).toBe(false)
      const sentinelSnap = await db.collection('erasure_active').doc('user-1').get()
      expect(sentinelSnap.exists).toBe(true)
      expect(mockUpdateUser).toHaveBeenCalledWith('user-1', { disabled: true })
    })
  })

  itif(available)('throws already-exists and does not call Auth if sentinel exists', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await db
        .collection('erasure_active')
        .doc('user-1')
        .set({ citizenUid: 'user-1', createdAt: Date.now() })
      const { getAuth } = await import('firebase-admin/auth')
      await expect(requestDataErasureCore(db, getAuth(), { uid: 'user-1' })).rejects.toMatchObject({
        code: 'already-exists',
      })
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })
  })

  itif(available)('rolls back sentinel and request doc if Auth disable throws', async () => {
    mockUpdateUser.mockRejectedValueOnce(new Error('auth error'))
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      await expect(requestDataErasureCore(db, getAuth(), { uid: 'user-2' })).rejects.toMatchObject({
        code: 'internal',
      })
      const sentinelSnap = await db.collection('erasure_active').doc('user-2').get()
      expect(sentinelSnap.exists).toBe(false)
      const reqSnap = await db
        .collection('erasure_requests')
        .where('citizenUid', '==', 'user-2')
        .get()
      expect(reqSnap.docs).toHaveLength(0)
    })
  })
})
