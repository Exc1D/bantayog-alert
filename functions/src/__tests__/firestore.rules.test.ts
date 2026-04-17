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
    projectId: 'demo-phase-1',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), '../infra/firebase/firestore.rules'), 'utf8'),
    },
  })

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()

    await db.collection('alerts').doc('hello').set({
      title: 'System online',
      body: 'Citizen shell wired for Phase 1.',
      severity: 'info',
      publishedAt: 1713350400000,
      publishedBy: 'phase-1-bootstrap',
    })

    await db.collection('system_config').doc('min_app_version').set({
      citizen: '0.1.0',
      admin: '0.1.0',
      responder: '0.1.0',
      updatedAt: 1713350400000,
    })

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

    await db
      .collection('active_accounts')
      .doc('suspended-1')
      .set({
        uid: 'suspended-1',
        role: 'municipal_admin',
        accountStatus: 'suspended',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
        mfaEnrolled: false,
        lastClaimIssuedAt: 1713350400000,
        updatedAt: 1713350400000,
      })

    await db.collection('claim_revocations').doc('super-1').set({
      uid: 'super-1',
      revokedAt: 1713350400000,
      reason: 'claims_updated',
    })
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

describe('phase 1 firestore rules', () => {
  it('allows authenticated users to read alerts', async () => {
    const db = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertSucceeds(db.collection('alerts').doc('hello').get())
  })

  it('blocks unauthenticated users from reading alerts', async () => {
    const db = testEnv.unauthenticatedContext().firestore()
    await assertFails(db.collection('alerts').doc('hello').get())
  })

  it('allows self-read on active_accounts and blocks cross-user reads', async () => {
    const ownDb = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    const otherDb = testEnv
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertSucceeds(ownDb.collection('active_accounts').doc('super-1').get())
    await assertFails(otherDb.collection('active_accounts').doc('super-1').get())
  })

  it('blocks suspended privileged writes through isActivePrivileged', async () => {
    const db = testEnv
      .authenticatedContext('suspended-1', {
        role: 'municipal_admin',
        accountStatus: 'active',
        municipalityId: 'daet',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertFails(
      db.collection('system_config').doc('min_app_version').set({
        citizen: '0.1.1',
        admin: '0.1.1',
        responder: '0.1.1',
        updatedAt: 1713350401000,
      }),
    )
  })

  it('allows active superadmin writes to system_config', async () => {
    const db = testEnv
      .authenticatedContext('super-1', {
        role: 'provincial_superadmin',
        accountStatus: 'active',
        permittedMunicipalityIds: ['daet'],
      })
      .firestore()

    await assertSucceeds(
      db.collection('system_config').doc('min_app_version').set({
        citizen: '0.1.1',
        admin: '0.1.1',
        responder: '0.1.1',
        updatedAt: 1713350401000,
      }),
    )
  })
})
