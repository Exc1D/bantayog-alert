import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-sms-rules')

  // Active superadmin
  await seedActiveAccount(env, {
    uid: 'super-1',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet'],
  })

  // Suspended superadmin (tests isActivePrivileged gate on sms_outbox read)
  await seedActiveAccount(env, {
    uid: 'super-suspended',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet'],
    accountStatus: 'suspended',
  })

  // Municipal admin (non-superadmin)
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })

  // Seed SMS docs for read tests
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'sms_inbox/inbox-1'), { body: 'test', from: '+63900', receivedAt: ts })
    await setDoc(doc(db, 'sms_outbox/outbox-1'), { body: 'test', to: '+63900', sentAt: ts })
    await setDoc(doc(db, 'sms_sessions/session-1'), { msisdnHash: 'hash', active: true })
    await setDoc(doc(db, 'sms_provider_health/twilio'), { status: 'ok', checkedAt: ts })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('sms rules', () => {
  // --- sms_inbox: all access denied ---

  it('any client read from sms_inbox fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(getDoc(doc(db, 'sms_inbox/inbox-1')))
  })

  it('any client write to sms_inbox fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'sms_inbox/new-msg'), { body: 'test', from: '+63900', receivedAt: ts }),
    )
  })

  // --- sms_outbox: read superadmin+active only, write always denied ---

  it('superadmin reads sms_outbox (positive)', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'sms_outbox/outbox-1')))
  })

  it('non-superadmin reads sms_outbox fails', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'sms_outbox/outbox-1')))
  })

  it('suspended superadmin reads sms_outbox fails', async () => {
    const db = authed(
      env,
      'super-suspended',
      staffClaims({
        role: 'provincial_superadmin',
        accountStatus: 'suspended',
      }),
    )
    await assertFails(getDoc(doc(db, 'sms_outbox/outbox-1')))
  })

  it('any client write to sms_outbox fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'sms_outbox/new-msg'), { body: 'test', to: '+63900', sentAt: ts }),
    )
  })

  // --- sms_sessions: all access denied ---

  it('any client read from sms_sessions fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(getDoc(doc(db, 'sms_sessions/session-1')))
  })

  it('any client write to sms_sessions fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'sms_sessions/new-session'), { msisdnHash: 'hash', active: true }),
    )
  })

  // --- sms_provider_health: read superadmin only, write always denied ---

  it('superadmin reads sms_provider_health (positive)', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'sms_provider_health/twilio')))
  })

  it('non-superadmin reads sms_provider_health fails', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'sms_provider_health/twilio')))
  })

  it('any client write to sms_provider_health fails', async () => {
    const db = authed(env, 'super-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(
      setDoc(doc(db, 'sms_provider_health/new-provider'), { status: 'ok', checkedAt: ts }),
    )
  })
})
