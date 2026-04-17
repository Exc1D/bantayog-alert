import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedUser, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-users')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedUser(env, 'user-1', { municipalityId: 'daet' })
})

afterAll(async () => {
  await env.cleanup()
})

describe('users rules', () => {
  it('user can read own document', async () => {
    const db = authed(env, 'user-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(getDoc(doc(db, 'users/user-1')))
  })

  it('user cannot read another user document', async () => {
    const db = authed(env, 'user-1', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'users/user-2')))
  })

  it('municipality admin can read users in their municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'users/user-1')))
  })

  it('municipality admin cannot write to users (callable-only)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(setDoc(doc(db, 'users/new-user'), { municipalityId: 'daet', createdAt: ts }))
  })
})
