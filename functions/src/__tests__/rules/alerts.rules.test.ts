import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  setLogLevel,
  where,
} from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = process.env.FIRESTORE_EMULATOR_HOST ? it : it.skip

const alertDoc = {
  alertId: 'alert-public',
  alertType: 'alert',
  hazardType: 'typhoon',
  affectedMunicipalityIds: ['daet'],
  municipalityId: 'daet',
  municipalityScope: { daet: true },
  message: 'Signal no. 3 raised.',
  declaredBy: 'admin-1',
  declaredAt: ts,
  publishedAt: ts,
  visibility: 'public',
  schemaVersion: 1,
}

beforeAll(async () => {
  setLogLevel('silent')
  env = await createTestEnvSafe('demo-alert-visibility')
  if (!env) return
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'labo-admin',
    role: 'municipal_admin',
    municipalityId: 'labo',
  })
  await seedActiveAccount(env, { uid: 'superadmin-1', role: 'provincial_superadmin' })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'alerts', 'alert-public'), alertDoc)
    await setDoc(doc(ctx.firestore(), 'alerts', 'alert-hidden'), {
      ...alertDoc,
      alertId: 'alert-hidden',
      visibility: 'internal',
    })
    await setDoc(doc(ctx.firestore(), 'alerts', 'alert-hidden-labo'), {
      ...alertDoc,
      alertId: 'alert-hidden-labo',
      affectedMunicipalityIds: ['labo'],
      municipalityId: 'labo',
      municipalityScope: { labo: true },
      visibility: 'internal',
    })
    const multiMunicipalityAlertDoc: Record<string, unknown> = {
      ...alertDoc,
      alertId: 'alert-hidden-multi',
      affectedMunicipalityIds: ['daet', 'labo'],
      municipalityScope: { daet: true, labo: true },
      visibility: 'internal',
    }
    // Production omits scalar municipalityId for multi-municipality alerts.
    Reflect.deleteProperty(multiMunicipalityAlertDoc, 'municipalityId')
    await setDoc(doc(ctx.firestore(), 'alerts', 'alert-hidden-multi'), multiMunicipalityAlertDoc)
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('alerts visibility rules', () => {
  itif('allows public alert reads without authentication', async () => {
    const db = unauthed(env)
    await assertSucceeds(getDoc(doc(db, 'alerts/alert-public')))
  })

  itif('rejects hidden alert reads for citizens', async () => {
    const db = authed(env, 'citizen-1', {})
    await assertFails(getDoc(doc(db, 'alerts/alert-hidden')))
  })

  itif('allows scoped municipal admins to read hidden alerts', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'alerts/alert-hidden')))
  })

  itif('allows scoped municipal admins to query their municipality alerts', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'alerts'),
          where('affectedMunicipalityIds', 'array-contains', 'daet'),
          where('visibility', '==', 'public'),
        ),
      ),
    )
  })

  itif('allows scoped municipal admins to query hidden affected alerts', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      getDocs(query(collection(db, 'alerts'), where('municipalityScope.daet', '==', true))),
    )
  })

  itif('allows restricted superadmins to query only permitted affected alerts', async () => {
    const db = authed(
      env,
      'superadmin-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
    )
    await assertSucceeds(
      getDocs(query(collection(db, 'alerts'), where('municipalityScope.daet', '==', true))),
    )
    await assertFails(
      getDocs(query(collection(db, 'alerts'), where('municipalityScope.labo', '==', true))),
    )
  })

  itif('rejects other municipal admins reading hidden alerts', async () => {
    const db = authed(
      env,
      'labo-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'labo' }),
    )
    await assertFails(getDoc(doc(db, 'alerts/alert-hidden')))
  })

  itif('allows superadmins to read hidden alerts', async () => {
    const db = authed(env, 'superadmin-1', staffClaims({ role: 'provincial_superadmin' }))
    await assertSucceeds(getDoc(doc(db, 'alerts/alert-hidden')))
  })

  itif(
    'rejects restricted superadmins reading hidden alerts outside permitted municipalities',
    async () => {
      const db = authed(
        env,
        'superadmin-1',
        staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: ['daet'] }),
      )
      await assertSucceeds(getDoc(doc(db, 'alerts/alert-hidden-multi')))
      await assertFails(getDoc(doc(db, 'alerts/alert-hidden-labo')))
    },
  )
})
