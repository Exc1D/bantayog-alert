import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedDispatchRT, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-dispatches')
  if (!env) return
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    municipalityId: 'daet',
    agencyId: 'bfp',
  })
  await seedDispatchRT(env, 'dispatch-1', {
    municipalityId: 'daet',
    status: 'accepted',
    assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
  })
  await seedDispatchRT(env, 'dispatch-2', {
    municipalityId: 'mercedes',
    status: 'accepted',
    assignedTo: { uid: 'resp-2', agencyId: 'pcg', municipalityId: 'mercedes' },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('dispatches rules', () => {
  itif(!!env)('municipality admin reads their own dispatches', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'dispatches/dispatch-1')))
  })

  itif(!!env)('municipality admin can query their own dispatches list', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      getDocs(query(collection(db, 'dispatches'), where('municipalityId', '==', 'daet'))),
    )
  })

  itif(!!env)('other municipality admin cannot read dispatches', async () => {
    const db = authed(
      env,
      'some-other-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'other' }),
    )
    await assertFails(getDoc(doc(db, 'dispatches/dispatch-1')))
  })

  itif(!!env)('assigned responder can read their dispatch', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertSucceeds(getDoc(doc(db, 'dispatches/dispatch-1')))
  })

  itif(!!env)('responder can query only their own dispatches', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'dispatches'),
          where('assignedTo.uid', '==', 'resp-1'),
          where('status', 'in', ['pending', 'accepted', 'acknowledged', 'en_route', 'on_scene']),
        ),
      ),
    )
  })

  itif(!!env)('responder cannot query another responder dispatch scope', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(
      getDocs(
        query(
          collection(db, 'dispatches'),
          where('assignedTo.uid', '==', 'resp-2'),
          where('status', 'in', ['pending', 'accepted', 'acknowledged', 'en_route', 'on_scene']),
        ),
      ),
    )
  })

  itif(!!env)('responder can update status with valid transition', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'dispatches/dispatch-1'), { status: 'acknowledged', updatedAt: ts }),
    )
  })

  itif(!!env)('responder cannot update with invalid status transition', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(
      updateDoc(doc(db, 'dispatches/dispatch-1'), { status: 'resolved', updatedAt: ts }),
    )
  })
})
