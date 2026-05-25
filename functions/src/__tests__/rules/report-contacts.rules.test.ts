import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-report-contacts')
  if (!env) return
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
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = ctx.firestore() as any

    await db.collection('report_contacts').doc('r-contacts-1').set({
      municipalityId: 'daet',
      reportId: 'r-contacts-1',
      primaryContactName: 'Test Contact',
      primaryContactPhone: '+639000000001',
      alternateContactName: 'Alt Contact',
      alternateContactPhone: '+639000000002',
      createdAt: 1713350400000,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('report_contacts rules', () => {
  itif(!!env)('daet-admin reads own-muni (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_contacts/r-contacts-1')))
  })

  itif(!!env)('mercedes-admin fails (negative)', async () => {
    const db = authed(
      env,
      'mercedes-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'report_contacts/r-contacts-1')))
  })

  itif(!!env)('responder fails', async () => {
    const db = authed(env, 'resp-1', staffClaims({ role: 'responder', agencyId: 'bfp' }))
    await assertFails(getDoc(doc(db, 'report_contacts/r-contacts-1')))
  })

  itif(!!env)('any client write fails', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    const { setDoc } = await import('firebase/firestore')
    await assertFails(
      setDoc(doc(db, 'report_contacts/new'), {
        municipalityId: 'daet',
        reportId: 'new',
        primaryContactName: 'Test',
        primaryContactPhone: '+639000000001',
      }),
    )
  })

  itif(!!env)('unauthed read fails', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'report_contacts/r-contacts-1')))
  })
})
