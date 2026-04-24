import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-report-sharing')
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
  await seedActiveAccount(env, {
    uid: 'mercedes-agency',
    role: 'agency_admin',
    municipalityId: 'mercedes',
    agencyId: 'bfp-mercedes',
  })
  await seedActiveAccount(env, {
    uid: 'libman-admin',
    role: 'municipal_admin',
    municipalityId: 'libman',
  })
  await seedActiveAccount(env, {
    uid: 'super-1',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet', 'mercedes'],
  })

  // Seed sharing doc owned by daet, shared with mercedes
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'report_sharing', 'r-share-1'), {
      ownerMunicipalityId: 'daet',
      sharedWith: ['mercedes'],
      reportId: 'r-share-1',
      createdAt: 1713350400000,
      updatedAt: 1713350400000,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('report_sharing rules', () => {
  it('owner municipality admin reads (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_sharing/r-share-1')))
  })

  it('recipient municipality admin whose myMunicipality() in sharedWith reads (positive)', async () => {
    const db = authed(
      env,
      'mercedes-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_sharing/r-share-1')))
  })

  it('active agency admin whose municipality is shared reads (positive)', async () => {
    const db = authed(
      env,
      'mercedes-agency',
      staffClaims({ role: 'agency_admin', municipalityId: 'mercedes', agencyId: 'bfp-mercedes' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_sharing/r-share-1')))
  })

  it('non-recipient admin fails (negative)', async () => {
    const db = authed(
      env,
      'libman-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'libman' }),
    )
    await assertFails(getDoc(doc(db, 'report_sharing/r-share-1')))
  })

  it('superadmin reads (positive)', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({
        role: 'provincial_superadmin',
        permittedMunicipalityIds: ['daet', 'mercedes'],
      }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_sharing/r-share-1')))
  })

  it('any client write fails', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(
      setDoc(doc(db, 'report_sharing/new'), {
        ownerMunicipalityId: 'daet',
        sharedWith: ['mercedes'],
      }),
    )
  })

  it('unauthed read fails', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'report_sharing/r-share-1')))
  })
})

const validEvent = {
  targetMunicipalityId: 'mercedes',
  sharedBy: 'daet-admin',
  sharedAt: 1713350400000,
  sharedReason: 'Border incident',
  source: 'manual',
  schemaVersion: 1,
}

describe('report_sharing/events rules', () => {
  it('allows muni admin to write event to subcollection', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      addDoc(collection(db, 'report_sharing', 'r-share-1', 'events'), validEvent),
    )
  })

  it('denies a different municipality admin from writing the share event', async () => {
    const db = authed(
      env,
      'mercedes-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(
      addDoc(collection(db, 'report_sharing', 'r-share-1', 'events'), {
        ...validEvent,
        sharedBy: 'mercedes-admin',
        targetMunicipalityId: 'daet',
      }),
    )
  })

  it('a second share appends a second event without overwriting first', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      addDoc(collection(db, 'report_sharing', 'r-share-1', 'events'), {
        ...validEvent,
        targetMunicipalityId: 'labo',
      }),
    )

    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(
        collection(ctx.firestore(), 'report_sharing', 'r-share-1', 'events'),
      )
      expect(snap.size).toBeGreaterThanOrEqual(2)
    })
  })

  it('denies citizen writes to events subcollection', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(addDoc(collection(db, 'report_sharing', 'r-share-1', 'events'), validEvent))
  })
})

describe('report_sharing/events rules — reads', () => {
  const seededEventId = 'seeded-evt-1'

  beforeAll(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'report_sharing', 'r-share-1', 'events', seededEventId),
        validEvent,
      )
    })
  })

  it('allows muni admin to read events subcollection (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_sharing', 'r-share-1', 'events', seededEventId)))
  })

  it('allows agency admin to read events subcollection (positive)', async () => {
    const db = authed(
      env,
      'mercedes-agency',
      staffClaims({ role: 'agency_admin', municipalityId: 'mercedes', agencyId: 'bfp-mercedes' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_sharing', 'r-share-1', 'events', seededEventId)))
  })

  it('allows superadmin to read events subcollection (positive)', async () => {
    const db = authed(
      env,
      'super-1',
      staffClaims({
        role: 'provincial_superadmin',
        permittedMunicipalityIds: ['daet', 'mercedes'],
      }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_sharing', 'r-share-1', 'events', seededEventId)))
  })

  it('denies citizen reads on events subcollection (negative)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'report_sharing', 'r-share-1', 'events', seededEventId)))
  })

  it('denies unauthenticated reads on events subcollection (negative)', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'report_sharing', 'r-share-1', 'events', seededEventId)))
  })
})
