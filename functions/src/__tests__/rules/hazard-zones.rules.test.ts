import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, collection, getDocs, addDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) => (condition ? it : it.skip)

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-hazards')
  if (!env) return
  await seedActiveAccount(env, {
    uid: 'super-1',
    role: 'provincial_superadmin',
    permittedMunicipalityIds: ['daet', 'mercedes'],
  })
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('hazard zones rules', () => {
  describe('hazard_zones', () => {
    itif(!!env)('superadmin can read hazard zones', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
      )
      await assertSucceeds(getDocs(collection(db, 'hazard_zones')))
    })

    itif(!!env)('municipality admin cannot read hazard zones', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(getDocs(collection(db, 'hazard_zones')))
    })

    itif(!!env)('hazard zone writes are callable-only', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(
        setDoc(doc(db, 'hazard_zones/zone-1'), {
          zoneId: 'zone-1',
          version: 1,
          hazardType: 'flood',
          scope: 'municipality',
          municipalityId: 'daet',
          createdAt: ts,
        }),
      )
    })
  })

  describe('hazard_zones_history', () => {
    itif(!!env)('hazard zones history are callable-only reads', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(getDocs(collection(db, 'hazard_zones_history')))
    })

    itif(!!env)('hazard zones history are callable-only writes', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(
        addDoc(collection(db, 'hazard_zones_history'), {
          zoneId: 'zone-1',
          version: 2,
          previousVersion: 1,
          replacedBy: 'admin',
          replacedAt: ts,
        }),
      )
    })
  })
})
