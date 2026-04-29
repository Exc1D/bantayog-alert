/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
      const db = ctx.firestore() as any // eslint-disable-line @typescript-eslint/no-explicit-any
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

      // Gap 10: assert remaining claims preserve non-break-glass keys
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user-1', { role: 'superadmin' })

      const docSnap = await db.collection('breakglass_events').doc('event-1').get()
      expect(docSnap.data().action).toBe('auto_expired')
      expect(docSnap.data().expiredAt).toBeDefined()
    })
  })

  it('skips sessions that have not yet expired', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any // eslint-disable-line @typescript-eslint/no-explicit-any
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

  it('counts failure but continues loop when setCustomUserClaims fails', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any // eslint-disable-line @typescript-eslint/no-explicit-any
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
      await db
        .collection('breakglass_events')
        .doc('event-4')
        .set({
          action: 'initiated',
          actorUid: 'user-4',
          sessionId: 'session-4',
          expiresAt: now - 1000,
          createdAt: now - 2000,
        })

      mockSetCustomUserClaims.mockRejectedValueOnce(new Error('claims update failed'))

      const result = await sweepExpiredBreakGlassSessionsCore({ db, auth: getAuth() })
      expect(result.expired).toBe(1)
      expect(result.failed).toBe(1)

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user-3', { role: 'superadmin' })
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user-4', { role: 'superadmin' })
    })
  })

  // Gap 1: getUser throwing (e.g., deleted user)
  it('counts failure but continues when getUser throws', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any // eslint-disable-line @typescript-eslint/no-explicit-any
      const { getAuth } = await import('firebase-admin/auth')
      const now = Date.now()
      await db
        .collection('breakglass_events')
        .doc('event-5')
        .set({
          action: 'initiated',
          actorUid: 'deleted-user',
          sessionId: 'session-5',
          expiresAt: now - 1000,
          createdAt: now - 2000,
        })
      await db
        .collection('breakglass_events')
        .doc('event-6')
        .set({
          action: 'initiated',
          actorUid: 'user-6',
          sessionId: 'session-6',
          expiresAt: now - 1000,
          createdAt: now - 2000,
        })

      mockGetUser.mockRejectedValueOnce(new Error('user not found'))

      const result = await sweepExpiredBreakGlassSessionsCore({ db, auth: getAuth() })
      expect(result.expired).toBe(1)
      expect(result.failed).toBe(1)

      expect(mockGetUser).toHaveBeenCalledWith('deleted-user')
      expect(mockGetUser).toHaveBeenCalledWith('user-6')
    })
  })

  // Gap 2: setCustomUserClaims succeeds but doc update fails
  it('counts failure when doc update fails after claims are cleared', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any // eslint-disable-line @typescript-eslint/no-explicit-any
      const { getAuth } = await import('firebase-admin/auth')
      const now = Date.now()
      await db
        .collection('breakglass_events')
        .doc('event-7')
        .set({
          action: 'initiated',
          actorUid: 'user-7',
          sessionId: 'session-7',
          expiresAt: now - 1000,
          createdAt: now - 2000,
        })

      const docRef = db.collection('breakglass_events').doc('event-7')
      const DocRefProto = Object.getPrototypeOf(docRef)
      const originalUpdate = DocRefProto.update
      DocRefProto.update = vi.fn().mockRejectedValueOnce(new Error('doc update failed'))

      const result = await sweepExpiredBreakGlassSessionsCore({ db, auth: getAuth() })
      expect(result.expired).toBe(0)
      expect(result.failed).toBe(1)

      // Claims were still cleared even though doc update failed
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith('user-7', { role: 'superadmin' })

      // Restore original update for cleanup
      DocRefProto.update = originalUpdate
    })
  })

  // Gap 8: deactivated action state exclusion
  it('does not auto-expire deactivated sessions', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any // eslint-disable-line @typescript-eslint/no-explicit-any
      const { getAuth } = await import('firebase-admin/auth')
      const now = Date.now()
      await db
        .collection('breakglass_events')
        .doc('event-8')
        .set({
          action: 'deactivated',
          actorUid: 'user-8',
          sessionId: 'session-8',
          expiresAt: now - 1000,
          createdAt: now - 2000,
        })

      const result = await sweepExpiredBreakGlassSessionsCore({ db, auth: getAuth() })
      expect(result.expired).toBe(0)
      expect(result.failed).toBe(0)

      expect(mockSetCustomUserClaims).not.toHaveBeenCalled()
    })
  })
})
