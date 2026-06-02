import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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
  env = await createTestEnvSafe('demo-phase-2-secret-lookup')
  if (!env) return
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = ctx.firestore()

    // Seed the secret_lookup doc and the report_private doc that links it
    // to reporterUid 'citizen-1' per the new rule restriction.
    await db.collection('report_private').doc('r-1').set({
      reporterUid: 'citizen-1',
      municipalityId: 'daet',
    })

    await db
      .collection('secret_lookup')
      .doc('hash-1')
      .set({
        publicRef: 'pub-ref-1',
        reportId: 'r-1',
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
      })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('secret_lookup rules', () => {
  itif(!!env)('authed user reads (positive)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(getDoc(doc(db, 'secret_lookup/hash-1')))
  })

  itif(!!env)('different authed user read fails (negative)', async () => {
    const db = authed(env, 'citizen-2', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'secret_lookup/hash-1')))
  })

  itif(!!env)('unauthed read fails (negative)', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'secret_lookup/hash-1')))
  })

  itif(!!env)('any client write fails (negative)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(
      setDoc(doc(db, 'secret_lookup/new'), {
        publicRef: 'new',
        reportId: 'r-new',
        expiresAt: Date.now(),
      }),
    )
  })

  itif(!!env)('unauthed write fails (negative)', async () => {
    const db = unauthed(env)
    await assertFails(
      setDoc(doc(db, 'secret_lookup/new'), {
        publicRef: 'new',
        reportId: 'r-new',
        expiresAt: Date.now(),
      }),
    )
  })
})
