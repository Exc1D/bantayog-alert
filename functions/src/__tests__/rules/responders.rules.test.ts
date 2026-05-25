import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedResponder, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-responders')
  if (!env) return
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    municipalityId: 'daet',
    agencyId: 'bfp',
  })
  await seedResponder(env, 'resp-1', { municipalityId: 'daet' })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('responders rules', () => {
  itif(!!env)('responder can read own document', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertSucceeds(getDoc(doc(db, 'responders/resp-1')))
  })

  itif(!!env)('responder cannot read other responder document', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(getDoc(doc(db, 'responders/responder-2')))
  })

  itif(!!env)('municipality admin can read responders in their municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'responders/resp-1')))
  })

  itif(!!env)('responder writes are callable-only', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(
      setDoc(doc(db, 'responders/new-responder'), {
        responderId: 'new-responder',
        municipalityId: 'daet',
        agencyId: 'bfp',
        createdAt: ts,
      }),
    )
  })
})
