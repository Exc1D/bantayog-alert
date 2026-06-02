import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe } from '../helpers/rules-harness.js'
import {
  seedActiveAccount,
  seedDispatchRT,
  seedReport,
  staffClaims,
  ts,
} from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-reports')
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
  await seedActiveAccount(env, { uid: 'bfp-responder', role: 'responder' })
  await seedReport(env, 'r-public', { visibilityClass: 'public_alertable' })
  await seedReport(env, 'r-internal', { visibilityClass: 'internal' })
  await seedDispatchRT(env, 'r-internal_bfp-responder', {
    reportId: 'r-internal',
    assignedTo: { uid: 'bfp-responder' },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('reports rules', () => {
  itif(!!env)('any authed user reads a public_alertable report', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(getDoc(doc(db, 'reports/r-public')))
  })

  itif(!!env)('non-municipality admin cannot read an internal report', async () => {
    const db = authed(
      env,
      'mercedes-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'mercedes' }),
    )
    await assertFails(getDoc(doc(db, 'reports/r-internal')))
  })

  itif(!!env)('municipality admin reads their own internal report', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports/r-internal')))
  })

  itif(!!env)('assigned responder reads their internal report', async () => {
    const db = authed(env, 'bfp-responder', staffClaims({ role: 'responder' }))
    await assertSucceeds(getDoc(doc(db, 'reports/r-internal')))
  })

  itif(!!env)('municipality admin may update mutable fields', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'reports/r-internal'), { status: 'assigned', updatedAt: ts }),
    )
  })

  itif(!!env)('municipality admin cannot mutate immutable fields like municipalityId', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(updateDoc(doc(db, 'reports/r-internal'), { municipalityId: 'mercedes' }))
  })
})
