import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

const sessionData = {
  uid: 'daet-admin',
  municipalityId: 'daet',
  enteredAt: ts,
  expiresAt: ts + 43200000,
  isActive: true,
  schemaVersion: 1,
}

beforeAll(async () => {
  env = await createTestEnv('field-mode-sessions-rules-test')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'other-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  await seedActiveAccount(env, { uid: 'superadmin', role: 'provincial_superadmin' })

  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'field_mode_sessions', 'daet-admin'), sessionData)
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('field_mode_sessions rules', () => {
  it('allows owner to read their own session', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  it('allows owner to write their own session', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(setDoc(doc(db, 'field_mode_sessions', 'daet-admin'), sessionData))
  })

  it('denies writes when embedded uid does not match the path', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(
      setDoc(doc(db, 'field_mode_sessions', 'daet-admin'), {
        ...sessionData,
        uid: 'other-admin',
      }),
    )
  })

  it('denies other user reading another user session', async () => {
    const db = authed(
      env,
      'other-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  it('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  it('denies superadmin writes to field_mode_sessions', async () => {
    const db = authed(env, 'superadmin', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(setDoc(doc(db, 'field_mode_sessions', 'daet-admin'), sessionData))
  })

  it('allows superadmin reads', async () => {
    const db = authed(env, 'superadmin', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })
})
