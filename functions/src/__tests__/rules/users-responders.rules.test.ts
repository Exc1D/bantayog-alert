import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-users-responders')

  // Responders
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'resp-2',
    role: 'responder',
    agencyId: 'red-cross',
    municipalityId: 'daet',
  })
  // Agency admins
  await seedActiveAccount(env, {
    uid: 'bfp-admin',
    role: 'agency_admin',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'redcross-admin',
    role: 'agency_admin',
    agencyId: 'red-cross',
    municipalityId: 'daet',
  })
  // Municipal admins
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'mercedes-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  // Citizens
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen', municipalityId: 'daet' })
  await seedActiveAccount(env, { uid: 'citizen-2', role: 'citizen', municipalityId: 'mercedes' })

  // Seed responder docs
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'responders/resp-1'), {
      uid: 'resp-1',
      municipalityId: 'daet',
      agencyId: 'bfp',
      displayName: 'Responder One',
      availabilityStatus: 'available',
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'responders/resp-2'), {
      uid: 'resp-2',
      municipalityId: 'daet',
      agencyId: 'red-cross',
      displayName: 'Responder Two',
      availabilityStatus: 'available',
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'users/citizen-1'), {
      uid: 'citizen-1',
      municipalityId: 'daet',
      displayName: 'Citizen One',
      role: 'citizen',
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'users/citizen-2'), {
      uid: 'citizen-2',
      municipalityId: 'mercedes',
      displayName: 'Citizen Two',
      role: 'citizen',
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('responders/{uid} rules', () => {
  it('responder self-read succeeds', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'responders/resp-1')))
  })

  it('agency admin reads own-agency responder (positive)', async () => {
    const db = authed(
      env,
      'bfp-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'responders/resp-1')))
  })

  it('muni admin reads own-muni responder (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'responders/resp-1')))
  })

  it('other-agency admin read fails', async () => {
    const db = authed(
      env,
      'redcross-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'red-cross', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'responders/resp-1')))
  })

  it('responder updates own availabilityStatus (positive)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(updateDoc(doc(db, 'responders/resp-1'), { availabilityStatus: 'busy' }))
  })

  it('responder attempts to change agencyId (negative — not in hasOnly)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(updateDoc(doc(db, 'responders/resp-1'), { agencyId: 'red-cross' }))
  })

  it('client create on responders always fails', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(
      setDoc(doc(db, 'responders/new-resp'), {
        uid: 'new-resp',
        municipalityId: 'daet',
        agencyId: 'bfp',
        availabilityStatus: 'available',
      }),
    )
  })

  it('client delete on responders always fails', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(deleteDoc(doc(db, 'responders/resp-1')))
  })
})

describe('users/{uid} rules', () => {
  it('user self-read succeeds', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertSucceeds(getDoc(doc(db, 'users/citizen-1')))
  })

  it('muni admin reads own-muni user (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'users/citizen-1')))
  })

  it('muni admin cannot read other-muni user', async () => {
    const db = authed(
      env,
      'mercedes-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'users/citizen-1')))
  })

  it('user updates own displayName (positive)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertSucceeds(updateDoc(doc(db, 'users/citizen-1'), { displayName: 'New Name' }))
  })

  it('user attempts to change own role (negative)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertFails(updateDoc(doc(db, 'users/citizen-1'), { role: 'municipal_admin' }))
  })

  it('client create on users always fails', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertFails(
      setDoc(doc(db, 'users/new-user'), {
        uid: 'new-user',
        municipalityId: 'daet',
        displayName: 'New',
        role: 'citizen',
      }),
    )
  })

  it('client delete on users always fails', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertFails(deleteDoc(doc(db, 'users/citizen-1')))
  })
})
