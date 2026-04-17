import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-event-collections')

  // Municipal admin of daet
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })

  // Municipal admin of mercedes (other muni — negative test)
  await seedActiveAccount(env, {
    uid: 'mercedes-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })

  // Superadmin (active)
  await seedActiveAccount(env, {
    uid: 'super-1',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet'],
  })

  // Superadmin (suspended — tests isActivePrivileged gate)
  await seedActiveAccount(env, {
    uid: 'super-suspended',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet'],
    accountStatus: 'suspended',
  })

  // Agency admin for bfp
  await seedActiveAccount(env, {
    uid: 'bfp-admin',
    role: 'agency_admin',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })

  // Agency admin for red-cross (other agency — negative test)
  await seedActiveAccount(env, {
    uid: 'redcross-admin',
    role: 'agency_admin',
    agencyId: 'red-cross',
    municipalityId: 'daet',
  })

  // Responder
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })

  // Citizen
  await seedActiveAccount(env, {
    uid: 'citizen-1',
    role: 'citizen',
    municipalityId: 'daet',
  })

  // Seed report_events docs — one for bfp agency, one for red-cross agency
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'report_events/re-1'), {
      agencyId: 'bfp',
      type: 'report_created',
      municipalityId: 'daet',
      reportId: 'r-1',
      createdAt: ts,
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'report_events/re-2'), {
      agencyId: 'red-cross',
      type: 'report_created',
      municipalityId: 'daet',
      reportId: 'r-2',
      createdAt: ts,
      schemaVersion: 1,
    })
    // Seed dispatch_events docs
    await setDoc(doc(db, 'dispatch_events/de-1'), {
      agencyId: 'bfp',
      type: 'dispatch_created',
      municipalityId: 'daet',
      dispatchId: 'd-1',
      createdAt: ts,
      schemaVersion: 1,
    })
    await setDoc(doc(db, 'dispatch_events/de-2'), {
      agencyId: 'red-cross',
      type: 'dispatch_created',
      municipalityId: 'daet',
      dispatchId: 'd-2',
      createdAt: ts,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('report_events — privileged read with agency scoping', () => {
  it('muni admin reads report_events (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_events/re-1')))
  })

  it('superadmin reads report_events (positive)', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_events/re-1')))
  })

  it('suspended superadmin reads report_events fails (negative — isActivePrivileged gate)', async () => {
    const db = authed(
      env,
      'super-suspended',
      staffClaims({
        role: 'provincial_superadmin',
        permittedMunicipalityIds: ['daet'],
        accountStatus: 'suspended',
      }),
    )
    await assertFails(getDoc(doc(db, 'report_events/re-1')))
  })

  it('agency admin reads report_events for own agency (positive)', async () => {
    const db = authed(
      env,
      'bfp-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_events/re-1')))
  })

  it('agency admin reads report_events for other agency fails (negative)', async () => {
    const db = authed(
      env,
      'redcross-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'red-cross', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'report_events/re-1')))
  })

  it('responder reads report_events fails (negative)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'report_events/re-1')))
  })

  it('citizen reads report_events fails (negative)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertFails(getDoc(doc(db, 'report_events/re-1')))
  })

  it('any client write to report_events fails', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertFails(
      setDoc(doc(db, 'report_events/re-new'), {
        agencyId: 'bfp',
        type: 'test',
        municipalityId: 'daet',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })
})

describe('dispatch_events — privileged read with agency scoping', () => {
  it('muni admin reads dispatch_events (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'dispatch_events/de-1')))
  })

  it('superadmin reads dispatch_events (positive)', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(getDoc(doc(db, 'dispatch_events/de-1')))
  })

  it('suspended superadmin reads dispatch_events fails (negative — isActivePrivileged gate)', async () => {
    const db = authed(
      env,
      'super-suspended',
      staffClaims({
        role: 'provincial_superadmin',
        permittedMunicipalityIds: ['daet'],
        accountStatus: 'suspended',
      }),
    )
    await assertFails(getDoc(doc(db, 'dispatch_events/de-1')))
  })

  it('agency admin reads dispatch_events for own agency (positive)', async () => {
    const db = authed(
      env,
      'bfp-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'dispatch_events/de-1')))
  })

  it('agency admin reads dispatch_events for other agency fails (negative)', async () => {
    const db = authed(
      env,
      'redcross-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'red-cross', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'dispatch_events/de-1')))
  })

  it('responder reads dispatch_events fails (negative)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(getDoc(doc(db, 'dispatch_events/de-1')))
  })

  it('citizen reads dispatch_events fails (negative)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen', municipalityId: 'daet' }))
    await assertFails(getDoc(doc(db, 'dispatch_events/de-1')))
  })

  it('any client write to dispatch_events fails', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertFails(
      setDoc(doc(db, 'dispatch_events/de-new'), {
        agencyId: 'bfp',
        type: 'test',
        municipalityId: 'daet',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })
})
