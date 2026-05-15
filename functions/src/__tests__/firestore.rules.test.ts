import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, describe, it } from 'vitest'

let testEnv: RulesTestEnvironment | undefined
let emulatorAvailable = false

try {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-phase-1',
    firestore: {
      host: '127.0.0.1',
      port: 8081,
      rules: readFileSync(resolve(process.cwd(), '../infra/firebase/firestore.rules'), 'utf8'),
    },
  })
  emulatorAvailable = true
} catch (err) {
  console.warn('[firestore.rules.test] Emulator unavailable; tests will skip.', err)
  emulatorAvailable = false
}

if (testEnv) {
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

    await db.collection('reports').doc('RPT-123').set({
      visibilityClass: 'internal',
      municipalityId: 'daet',
      status: 'new',
      submittedAt: 1713350400000,
      schemaVersion: 1,
    })

    await db.collection('report_private').doc('RPT-123').set({
      reporterUid: 'anon-citizen-1',
      municipalityId: 'daet',
      isPseudonymous: false,
      publicTrackingRef: 'ABC-123',
      createdAt: 1713350400000,
      schemaVersion: 1,
    })
  })
}

const itif = (condition: boolean) => (condition ? it : it.skip)

afterAll(async () => {
  if (testEnv) await testEnv.cleanup()
})

describe('phase 1 firestore rules', () => {
  itif(emulatorAvailable)('allows authenticated users to read alerts', async () => {
    const db = testEnv!
      .authenticatedContext('citizen-1', {
        role: 'citizen',
        accountStatus: 'active',
      })
      .firestore()

    await assertSucceeds(db.collection('alerts').doc('hello').get())
  })

  itif(emulatorAvailable)('allows unauthenticated users to read alerts (public feed)', async () => {
    const db = testEnv!.unauthenticatedContext().firestore()
    await assertSucceeds(db.collection('alerts').doc('hello').get())
    await assertFails(db.collection('alerts').doc('hello').set({ text: 'x' }))
    await assertFails(db.collection('alerts').doc('hello').update({ text: 'x' }))
    await assertFails(db.collection('alerts').doc('hello').delete())
  })

  itif(emulatorAvailable)(
    'allows self-read on active_accounts and blocks cross-user reads',
    async () => {
      const ownDb = testEnv!
        .authenticatedContext('super-1', {
          role: 'provincial_superadmin',
          accountStatus: 'active',
          permittedMunicipalityIds: ['daet'],
        })
        .firestore()

      const otherDb = testEnv!
        .authenticatedContext('citizen-1', {
          role: 'citizen',
          accountStatus: 'active',
        })
        .firestore()

      await assertSucceeds(ownDb.collection('active_accounts').doc('super-1').get())
      await assertFails(otherDb.collection('active_accounts').doc('super-1').get())
    },
  )

  itif(emulatorAvailable)(
    'blocks suspended privileged writes through isActivePrivileged',
    async () => {
      const db = testEnv!
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
    },
  )

  itif(emulatorAvailable)(
    'allows reporter (including anonymous) to read their own report',
    async () => {
      const db = testEnv!.authenticatedContext('anon-citizen-1', {}).firestore()

      await assertSucceeds(db.collection('reports').doc('RPT-123').get())
    },
  )

  itif(emulatorAvailable)(
    'blocks a different authenticated user from reading a non-public report',
    async () => {
      const db = testEnv!
        .authenticatedContext('other-citizen', {
          role: 'citizen',
          accountStatus: 'active',
        })
        .firestore()

      await assertFails(db.collection('reports').doc('RPT-123').get())
    },
  )

  itif(emulatorAvailable)('blocks unauthenticated reads on non-public reports', async () => {
    const db = testEnv!.unauthenticatedContext().firestore()
    await assertFails(db.collection('reports').doc('RPT-123').get())
  })

  itif(emulatorAvailable)('allows active superadmin writes to system_config', async () => {
    const db = testEnv!
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

  itif(emulatorAvailable)(
    'superadmin with empty permittedMunicipalityIds can read non-public reports',
    async () => {
      const db = testEnv!
        .authenticatedContext('super-empty-muni', {
          role: 'provincial_superadmin',
          accountStatus: 'active',
          permittedMunicipalityIds: [], // empty - was blocking read
        })
        .firestore()

      await assertSucceeds(db.collection('reports').doc('RPT-123').get())
    },
  )
})
