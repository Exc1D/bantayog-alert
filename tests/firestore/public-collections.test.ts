import { describe, it, beforeAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getTestEnv } from './setup'
import { citizenCtx, unauthCtx, superadminCtx, muniAdminCtx } from './helpers'

describe('public collection rules', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'active_accounts', 'superadmin_1'), {
        accountStatus: 'active',
        lastUpdatedAt: new Date(),
      })
      await setDoc(doc(ctx.firestore(), 'alerts', 'alert_1'), { title: 'test alert' })
      await setDoc(doc(ctx.firestore(), 'emergencies', 'em_1'), { title: 'test emergency' })
      await setDoc(doc(ctx.firestore(), 'agencies', 'bfp'), { name: 'BFP' })
      await setDoc(doc(ctx.firestore(), 'system_config', 'timeouts'), { high: 180 })
      await setDoc(doc(ctx.firestore(), 'audit_logs', 'log_1'), { event: 'test' })
    })
  })

  it('should allow any authed user to read alerts', async () => {
    const ctx = citizenCtx(testEnv)
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'alerts', 'alert_1')))
  })

  it('should reject unauthenticated read of alerts', async () => {
    const ctx = unauthCtx(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'alerts', 'alert_1')))
  })

  it('should allow any authed user to read emergencies', async () => {
    const ctx = citizenCtx(testEnv)
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'emergencies', 'em_1')))
  })

  it('should allow any authed user to read agencies', async () => {
    const ctx = citizenCtx(testEnv)
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'agencies', 'bfp')))
  })

  it('should allow superadmin to write agencies', async () => {
    const ctx = superadminCtx(testEnv)
    await assertSucceeds(setDoc(doc(ctx.firestore(), 'agencies', 'pnp'), { name: 'PNP' }))
  })

  it('should reject non-superadmin write to agencies', async () => {
    const ctx = muniAdminCtx(testEnv)
    await assertFails(setDoc(doc(ctx.firestore(), 'agencies', 'pnp'), { name: 'PNP' }))
  })

  it('should allow superadmin to read audit_logs', async () => {
    const ctx = superadminCtx(testEnv)
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'audit_logs', 'log_1')))
  })

  it('should reject non-superadmin read of audit_logs', async () => {
    const ctx = muniAdminCtx(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'audit_logs', 'log_1')))
  })

  it('should reject all client access to rate_limits', async () => {
    const ctx = superadminCtx(testEnv)
    await assertFails(getDoc(doc(ctx.firestore(), 'rate_limits', 'any')))
  })
})
