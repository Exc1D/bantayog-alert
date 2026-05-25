import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedReport, staffClaims } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-report-private')
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
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedActiveAccount(env, {
    uid: 'suspended-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
    accountStatus: 'suspended',
  })
  await seedReport(env, 'r-daet')
})

afterAll(async () => {
  await env?.cleanup()
})

describe('report_private rules', () => {
  itif(!!env)('daet-admin reads own-muni private doc (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_private/r-daet')))
  })

  itif(!!env)(
    'mercedes-admin reading daet-muni private doc fails (cross-muni leak negative)',
    async () => {
      const db = authed(
        env,
        'mercedes-admin',
        staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
      )
      await assertFails(getDoc(doc(db, 'report_private/r-daet')))
    },
  )

  itif(!!env)('citizen reading their own report_private fails (admin-only rule)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'report_private/r-daet')))
  })

  itif(!!env)('suspended daet-admin fails (active_accounts.accountStatus != active)', async () => {
    const db = authed(
      env,
      'suspended-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet', accountStatus: 'suspended' }),
    )
    await assertFails(getDoc(doc(db, 'report_private/r-daet')))
  })

  itif(!!env)('any client write fails (callable-only)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    const { setDoc } = await import('firebase/firestore')
    await assertFails(setDoc(doc(db, 'report_private/new'), { municipalityId: 'daet' }))
  })

  itif(!!env)('unauthed read fails', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'report_private/r-daet')))
  })
})
