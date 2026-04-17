import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-public-collections',
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
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: true,
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      })

    // Active municipal_admin
    await db.collection('active_accounts').doc('muni-admin-1').set({
      uid: 'muni-admin-1',
      role: 'municipal_admin',
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
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

// ================================================================
// Default-deny guardrail — unmapped collections must reject all access.
// This ensures no accidental collection leak if a new collection is
// added to Firestore without a corresponding rules block.
// ================================================================
describe('default-deny guardrail — unmapped collections', () => {
  it('unauthenticated write to unmapped collection fails', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    const { setDoc, doc } = await import('firebase/firestore')
    await assertFails(setDoc(doc(db, 'not_a_collection/x'), { a: 1 }))
  })

  it('citizen write to unmapped collection fails', async () => {
    const db = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()
    const { setDoc, doc } = await import('firebase/firestore')
    await assertFails(setDoc(doc(db, 'not_a_collection/x'), { a: 1 }))
  })

  it('municipal_admin write to unmapped collection fails', async () => {
    const db = testEnv
      .authenticatedContext('muni-admin-1', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
      })
      .firestore()
    const { setDoc, doc } = await import('firebase/firestore')
    await assertFails(setDoc(doc(db, 'not_a_collection/x'), { a: 1 }))
  })

  it('superadmin write to unmapped collection fails', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()
    const { setDoc, doc } = await import('firebase/firestore')
    await assertFails(setDoc(doc(db, 'not_a_collection/x'), { a: 1 }))
  })

  it('unauthenticated read from unmapped collection fails', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    const { getDoc, doc } = await import('firebase/firestore')
    await assertFails(getDoc(doc(db, 'not_a_collection/x')))
  })

  it('any role read from unmapped collection fails', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()
    const { getDoc, doc } = await import('firebase/firestore')
    await assertFails(getDoc(doc(db, 'not_a_collection/x')))
  })
})
