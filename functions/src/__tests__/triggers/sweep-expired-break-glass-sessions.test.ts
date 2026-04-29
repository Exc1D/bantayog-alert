/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { sweepExpiredBreakGlassSessionsCore } from '../../triggers/sweep-expired-break-glass-sessions.js'

const mockGetUser = vi.fn()
const mockSetCustomUserClaims = vi.fn().mockResolvedValue(undefined)

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ getUser: mockGetUser, setCustomUserClaims: mockSetCustomUserClaims }),
}))
vi.mock('../../services/audit-stream.js', () => ({ streamAuditEvent: vi.fn() }))

let env: RulesTestEnvironment | undefined

beforeEach(async () => {
  mockGetUser.mockReset()
  mockSetCustomUserClaims.mockReset()
  mockGetUser.mockResolvedValue({ customClaims: { breakGlassSession: true, role: 'superadmin' } })
  mockSetCustomUserClaims.mockResolvedValue(undefined)
  env = await initializeTestEnvironment({
    projectId: 'demo-break-glass-sweep',
    firestore: { host: 'localhost', port: 8081 },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const snap = await db.collection('breakglass_events').get()
    await Promise.all(snap.docs.map((d) => d.ref.delete()))
  })
})

afterEach(async () => {
  await env?.cleanup()
})

describe('sweepExpiredBreakGlassSessionsCore', () => {
  it('expires initiated sessions past their expiration and clears claims', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      const now = Date.now()
      await db
        .collection('breakglass_events')
        .doc('event-1')
        .set({
          action: 'initiated',
          actorUid: 'user-1',
          sessionId: 'session-1',
          expiresAt: now - 1000,
          createdAt: now - 2000,
        })

      const result = await sweepExpiredBreakGlassSessionsCore({ db, auth: getAuth() })
      expect(result.expired).toBe(1)
      expect(result.failed).toBe(0)

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user-1', { role: 'superadmin' })

      const docSnap = await db.collection('breakglass_events').doc('event-1').get()
      expect(docSnap.data().action).toBe('auto_expired')
      expect(docSnap.data().expiredAt).toBeDefined()
    })
  })

  it('skips sessions that have not yet expired', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      const now = Date.now()
      await db
        .collection('breakglass_events')
        .doc('event-2')
        .set({
          action: 'initiated',
          actorUid: 'user-2',
          sessionId: 'session-2',
          expiresAt: now + 1000,
          createdAt: now - 2000,
        })

      const result = await sweepExpiredBreakGlassSessionsCore({ db, auth: getAuth() })
      expect(result.expired).toBe(0)
      expect(result.failed).toBe(0)

      expect(mockSetCustomUserClaims).not.toHaveBeenCalled()
    })
  })

  it('throws when setCustomUserClaims fails so claims are not left persistent', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const { getAuth } = await import('firebase-admin/auth')
      const now = Date.now()
      await db
        .collection('breakglass_events')
        .doc('event-3')
        .set({
          action: 'initiated',
          actorUid: 'user-3',
          sessionId: 'session-3',
          expiresAt: now - 1000,
          createdAt: now - 2000,
        })

      mockSetCustomUserClaims.mockRejectedValueOnce(new Error('claims update failed'))

      await expect(sweepExpiredBreakGlassSessionsCore({ db, auth: getAuth() })).rejects.toThrow(
        'claims update failed',
      )

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user-3', { role: 'superadmin' })
    })
  })
})
