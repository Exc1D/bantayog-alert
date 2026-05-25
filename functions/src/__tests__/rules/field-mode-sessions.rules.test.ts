import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const sessionData = {
  uid: 'daet-admin',
  municipalityId: 'daet',
  enteredAt: ts,
  expiresAt: ts + 43200000,
  isActive: true,
  schemaVersion: 1,
}

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('field-mode-sessions-rules-test')
  if (!env) return
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
  await env?.cleanup()
})

describe('field_mode_sessions rules', () => {
  itif(!!env)('allows owner to read their own session', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  itif(!!env)('allows owner to write their own session', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(setDoc(doc(db, 'field_mode_sessions', 'daet-admin'), sessionData))
  })

  itif(!!env)('denies writes when embedded uid does not match the path', async () => {
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

  itif(!!env)('denies other user reading another user session', async () => {
    const db = authed(
      env,
      'other-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  itif(!!env)('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })

  itif(!!env)('denies superadmin writes to field_mode_sessions', async () => {
    const db = authed(env, 'superadmin', staffClaims({ role: 'provincial_superadmin' }))
    await assertFails(setDoc(doc(db, 'field_mode_sessions', 'daet-admin'), sessionData))
  })

  itif(!!env)('allows superadmin reads', async () => {
    const db = authed(env, 'superadmin', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'field_mode_sessions', 'daet-admin')))
  })
})
