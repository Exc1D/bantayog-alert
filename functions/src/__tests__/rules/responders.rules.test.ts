import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedResponder, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-responders')
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
  await seedResponder(env, 'responder-1', { municipalityId: 'daet' })
})

afterAll(async () => {
  await env.cleanup()
})

describe('responders rules', () => {
  it('responder can read own document', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertSucceeds(getDoc(doc(db, 'responders/responder-1')))
  })

  it('responder cannot read other responder document', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(getDoc(doc(db, 'responders/responder-2')))
  })

  it('municipality admin can read responders in their municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'responders/responder-1')))
  })

  it('responder writes are callable-only', async () => {
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
