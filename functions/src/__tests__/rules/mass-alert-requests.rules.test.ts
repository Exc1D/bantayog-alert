import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { createTestEnv, authed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'
import { setDoc, getDoc, doc } from 'firebase/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await createTestEnv('mass-alert-rules-test')
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await seedActiveAccount(testEnv, {
    uid: 'admin-uid',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(testEnv, {
    uid: 'super-admin',
    role: 'provincial_superadmin',
  })
  await seedActiveAccount(testEnv, {
    uid: 'citizen-1',
    role: 'citizen',
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

const now = 1713350400000

function baseAlert(status: string) {
  return {
    requestedByMunicipality: 'daet',
    requestedByUid: 'admin-uid',
    severity: 'high' as const,
    body: 'Typhoon warning',
    targetType: 'municipality' as const,
    estimatedReach: 5000,
    status,
    createdAt: now,
    schemaVersion: 1,
  }
}

describe('mass_alert_requests rules', () => {
  it('allows muni admin to create a request with status queued', async () => {
    const db = authed(
      testEnv,
      'admin-uid',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(setDoc(doc(db, 'mass_alert_requests', 'req-1'), baseAlert('queued')))
  })

  it('allows muni admin to create a request with status pending_ndrrmc_review', async () => {
    const db = authed(
      testEnv,
      'admin-uid',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      setDoc(doc(db, 'mass_alert_requests', 'req-2'), baseAlert('pending_ndrrmc_review')),
    )
  })

  it('denies creation with status forwarded_to_ndrrmc (superadmin-only transition)', async () => {
    const db = authed(
      testEnv,
      'admin-uid',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(
      setDoc(doc(db, 'mass_alert_requests', 'req-3'), baseAlert('forwarded_to_ndrrmc')),
    )
  })

  it('denies citizen writes', async () => {
    const db = authed(testEnv, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(setDoc(doc(db, 'mass_alert_requests', 'req-4'), baseAlert('queued')))
  })

  it('allows muni admin to read own municipality request', async () => {
    const adminDb = authed(
      testEnv,
      'admin-uid',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(setDoc(doc(adminDb, 'mass_alert_requests', 'read-1'), baseAlert('queued')))
    await assertSucceeds(getDoc(doc(adminDb, 'mass_alert_requests', 'read-1')))
  })

  it('allows active superadmin to read any request', async () => {
    const adminDb = authed(
      testEnv,
      'admin-uid',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(setDoc(doc(adminDb, 'mass_alert_requests', 'read-2'), baseAlert('queued')))

    const superDb = authed(testEnv, 'super-admin', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(superDb, 'mass_alert_requests', 'read-2')))
  })

  it('denies read for inactive privileged account', async () => {
    const inactiveDb = authed(
      testEnv,
      'admin-uid',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet', accountStatus: 'suspended' }),
    )
    await assertFails(getDoc(doc(inactiveDb, 'mass_alert_requests', 'read-3')))
  })
})
