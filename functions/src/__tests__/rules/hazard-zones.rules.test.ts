import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, collection, getDocs, addDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-hazards')
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
  await env.cleanup()
})

describe('hazard zones rules', () => {
  describe('hazard_zones', () => {
    it('superadmin can read hazard zones', async () => {
      const db = authed(
        env,
        'super-1',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
      )
      await assertSucceeds(getDocs(collection(db, 'hazard_zones')))
    })

    it('municipality admin cannot read hazard zones', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(getDocs(collection(db, 'hazard_zones')))
    })

    it('hazard zone writes are callable-only', async () => {
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

  describe('hazard_signals', () => {
    it('hazard signals are readable by authenticated users', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertSucceeds(getDocs(collection(db, 'hazard_signals')))
    })

    it('citizens can read hazard signals', async () => {
      // isAuthed() allows any active authenticated user — verify citizen role is covered
      const db = authed(env, 'citizen-1', { accountStatus: 'active' })
      await assertSucceeds(getDocs(collection(db, 'hazard_signals')))
    })

    it('hazard signals are callable-only writes', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(
        addDoc(collection(db, 'hazard_signals'), {
          zoneId: 'zone-1',
          version: 1,
          detectedAt: ts,
          severity: 'high',
        }),
      )
    })
  })

  describe('hazard_zones_history', () => {
    it('hazard zones history are callable-only reads', async () => {
      const db = authed(
        env,
        'daet-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
      )
      await assertFails(getDocs(collection(db, 'hazard_zones_history')))
    })

    it('hazard zones history are callable-only writes', async () => {
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
