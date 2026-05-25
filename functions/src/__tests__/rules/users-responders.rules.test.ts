import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedUser, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-users')
  if (!env) return
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedUser(env, 'user-1', { municipalityId: 'daet' })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('users rules', () => {
  itif(!!env)('user can read own document', async () => {
    const db = authed(env, 'user-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(getDoc(doc(db, 'users/user-1')))
  })

  itif(!!env)('user cannot read another user document', async () => {
    const db = authed(env, 'user-1', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'users/user-2')))
  })

  itif(!!env)('municipality admin can read users in their municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'users/user-1')))
  })

  itif(!!env)('municipality admin cannot write to users (callable-only)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(setDoc(doc(db, 'users/new-user'), { municipalityId: 'daet', createdAt: ts }))
  })
})
