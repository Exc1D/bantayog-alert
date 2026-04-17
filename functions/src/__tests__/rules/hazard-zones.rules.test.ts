import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-hazard-zones',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), '../infra/firebase/firestore.rules'), 'utf8'),
    },
  })

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    // Active superadmin
    await db
      .collection('active_accounts')
      .doc('super-1')
      .set({
        uid: 'super-1',
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet', 'mercedes'],
        mfaEnrolled: true,
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      })

    // Suspended superadmin
    await db
      .collection('active_accounts')
      .doc('suspended-super-1')
      .set({
        uid: 'suspended-super-1',
        role: 'provincial_superadmin',
        accountStatus: 'suspended',
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: true,
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      })

    // Active municipal_admin for daet
    await db.collection('active_accounts').doc('muni-admin-daet').set({
      uid: 'muni-admin-daet',
      role: 'municipal_admin',
      accountStatus: 'active',
      municipalityId: 'daet',
      mfaEnrolled: true,
      lastClaimIssuedAt: 1713350400000,
      updatedAt: 1713350400000,
    })

    // Active municipal_admin for mercedes
    await db.collection('active_accounts').doc('muni-admin-mercedes').set({
      uid: 'muni-admin-mercedes',
      role: 'municipal_admin',
      accountStatus: 'active',
      municipalityId: 'mercedes',
      mfaEnrolled: true,
      lastClaimIssuedAt: 1713350400000,
      updatedAt: 1713350400000,
    })

    // Suspended municipal_admin
    await db.collection('active_accounts').doc('suspended-muni-admin').set({
      uid: 'suspended-muni-admin',
      role: 'municipal_admin',
      accountStatus: 'suspended',
      municipalityId: 'daet',
      mfaEnrolled: true,
      lastClaimIssuedAt: 1713350400000,
      updatedAt: 1713350400000,
    })

    // Active agency_admin
    await db.collection('active_accounts').doc('agency-admin-1').set({
      uid: 'agency-admin-1',
      role: 'agency_admin',
      accountStatus: 'active',
      agencyId: 'agency-a',
      mfaEnrolled: true,
      lastClaimIssuedAt: 1713350400000,
      updatedAt: 1713350400000,
    })

    // Active responder
    await db.collection('active_accounts').doc('responder-1').set({
      uid: 'responder-1',
      role: 'responder',
      accountStatus: 'active',
      municipalityId: 'daet',
      mfaEnrolled: true,
      lastClaimIssuedAt: 1713350400000,
      updatedAt: 1713350400000,
    })

    // Active citizen
    await db.collection('active_accounts').doc('citizen-1').set({
      uid: 'citizen-1',
      role: 'citizen',
      accountStatus: 'active',
      mfaEnrolled: true,
      lastClaimIssuedAt: 1713350400000,
      updatedAt: 1713350400000,
    })

    // Seed hazard zone documents
    await db.collection('hazard_zones').doc('ref-daet').set({
      zoneType: 'reference',
      scope: 'municipality',
      municipalityId: 'daet',
      name: 'Reference Zone Daet',
    })

    await db.collection('hazard_zones').doc('ref-mercedes').set({
      zoneType: 'reference',
      scope: 'municipality',
      municipalityId: 'mercedes',
      name: 'Reference Zone Mercedes',
    })

    await db.collection('hazard_zones').doc('custom-daet').set({
      zoneType: 'custom',
      scope: 'municipality',
      municipalityId: 'daet',
      name: 'Custom Zone Daet',
    })

    await db.collection('hazard_zones').doc('custom-mercedes').set({
      zoneType: 'custom',
      scope: 'municipality',
      municipalityId: 'mercedes',
      name: 'Custom Zone Mercedes',
    })

    await db.collection('hazard_zones').doc('custom-provincial').set({
      zoneType: 'custom',
      scope: 'provincial',
      name: 'Custom Zone Provincial',
    })

    // Seed history subcollection
    await db.collection('hazard_zones').doc('ref-daet').collection('history').doc('v1').set({
      zoneType: 'reference',
      scope: 'municipality',
      municipalityId: 'daet',
      name: 'Reference Zone Daet v1',
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

// ================================================================
// Read tests — superadmin
// ================================================================
describe('hazard_zones read — superadmin', () => {
  it('superadmin reads a reference zone (positive)', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet', 'mercedes'],
      })
      .firestore()

    await assertSucceeds(db.collection('hazard_zones').doc('ref-daet').get())
  })

  it('superadmin reads a custom provincial zone (positive)', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet', 'mercedes'],
      })
      .firestore()

    await assertSucceeds(db.collection('hazard_zones').doc('custom-provincial').get())
  })

  it('superadmin reads a custom municipal zone (positive)', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertSucceeds(db.collection('hazard_zones').doc('custom-daet').get())
  })
})

// ================================================================
// Read tests — municipal_admin
// ================================================================
describe('hazard_zones read — municipal_admin', () => {
  it('muni admin reads any reference zone (positive)', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertSucceeds(db.collection('hazard_zones').doc('ref-daet').get())
    await assertSucceeds(db.collection('hazard_zones').doc('ref-mercedes').get())
  })

  it('muni admin reads own-muni custom zone (positive)', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertSucceeds(db.collection('hazard_zones').doc('custom-daet').get())
  })

  it('muni admin reads other-muni custom zone fails', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('custom-mercedes').get())
  })

  it('muni admin reads provincial-scope custom zone fails', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('custom-provincial').get())
  })
})

// ================================================================
// Read tests — other roles
// ================================================================
describe('hazard_zones read — other roles', () => {
  it('agency admin reads any zone fails', async () => {
    const db = testEnv
      .authenticatedContext('agency-admin-1', {
        role: 'agency_admin',
        accountStatus: 'active',
        agencyId: 'agency-a',
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('ref-daet').get())
  })

  it('responder reads any zone fails', async () => {
    const db = testEnv
      .authenticatedContext('responder-1', {
        role: 'responder',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('ref-daet').get())
  })

  it('citizen reads any zone fails', async () => {
    const db = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('ref-daet').get())
  })
})

// ================================================================
// Write tests — all roles blocked
// ================================================================
describe('hazard_zones write — all roles blocked', () => {
  it('superadmin create fails', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('new-zone').set({ name: 'new' }))
  })

  it('superadmin update fails', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('ref-daet').set({ name: 'updated' }))
  })

  it('superadmin delete fails', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('ref-daet').delete())
  })

  it('muni admin create fails', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('new-zone').set({ name: 'new' }))
  })

  it('citizen create fails', async () => {
    const db = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('new-zone').set({ name: 'new' }))
  })
})

// ================================================================
// history subcollection
// ================================================================
describe('hazard_zones history/{version}', () => {
  it('superadmin reads history (positive)', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertSucceeds(
      db.collection('hazard_zones').doc('ref-daet').collection('history').doc('v1').get(),
    )
  })

  it('muni admin reads own-muni zone history (positive)', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertSucceeds(
      db.collection('hazard_zones').doc('ref-daet').collection('history').doc('v1').get(),
    )
  })

  it('muni admin reads other-muni zone history fails', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertFails(
      db.collection('hazard_zones').doc('ref-mercedes').collection('history').doc('v1').get(),
    )
  })

  it('superadmin write to history fails', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(
      db
        .collection('hazard_zones')
        .doc('ref-daet')
        .collection('history')
        .doc('new-v')
        .set({ name: 'new' }),
    )
  })

  it('muni admin write to history fails', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-daet', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()

    await assertFails(
      db
        .collection('hazard_zones')
        .doc('ref-daet')
        .collection('history')
        .doc('new-v')
        .set({ name: 'new' }),
    )
  })
})

// ================================================================
// Suspended accounts
// ================================================================
describe('hazard_zones read — suspended accounts', () => {
  it('suspended superadmin fails', async () => {
    const db = testEnv
      .authenticatedContext('suspended-super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'suspended',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('ref-daet').get())
  })

  it('suspended muni admin fails', async () => {
    const db = testEnv
      .authenticatedContext('suspended-muni-admin', {
        role: 'municipal_admin',
        accountStatus: 'suspended',
        municipalityId: 'daet',
      })
      .firestore()

    await assertFails(db.collection('hazard_zones').doc('ref-daet').get())
  })
})
