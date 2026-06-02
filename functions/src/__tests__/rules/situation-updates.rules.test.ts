import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = process.env.FIRESTORE_EMULATOR_HOST ? it : it.skip

const validUpdate = {
  authorUid: 'citizen-1',
  createdAt: ts,
  municipalityId: 'daet',
  municipalityLabel: 'Daet',
  barangayLabel: 'San Jose',
  hazardType: 'typhoon',
  condition: 'heavy_rain',
  body: 'Strong rain and ankle-deep water near the market.',
  visibility: 'public',
  reportedCount: 0,
}

beforeAll(async () => {
  setLogLevel('silent')
  env = await createTestEnvSafe('demo-situation-updates')
  if (!env) return
  await seedActiveAccount(env, { uid: 'admin-1', role: 'provincial_superadmin' })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'situation_updates', 'seed-public'), validUpdate)
    await setDoc(doc(ctx.firestore(), 'situation_updates', 'seed-hidden'), {
      ...validUpdate,
      visibility: 'internal',
    })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('situation_updates rules', () => {
  itif('allows any signed-in citizen context to create its own public update', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(addDoc(collection(db, 'situation_updates'), validUpdate))
  })

  itif('rejects updates written for another uid', async () => {
    const db = authed(env, 'citizen-2', {})
    await assertFails(addDoc(collection(db, 'situation_updates'), validUpdate))
  })

  itif('rejects unauthenticated update creation', async () => {
    const db = unauthed(env)
    await assertFails(addDoc(collection(db, 'situation_updates'), validUpdate))
  })

  itif('rejects overly long update bodies', async () => {
    const db = authed(env, 'citizen-1', {})
    await assertFails(
      addDoc(collection(db, 'situation_updates'), {
        ...validUpdate,
        body: 'x'.repeat(501),
      }),
    )
  })

  itif('allows public reads without authentication', async () => {
    const db = unauthed(env)
    await assertSucceeds(getDoc(doc(db, 'situation_updates/seed-public')))
  })

  itif('rejects hidden update reads for citizens', async () => {
    const db = authed(env, 'citizen-1', {})
    await assertFails(getDoc(doc(db, 'situation_updates/seed-hidden')))
  })

  itif('allows scoped municipal admins to read hidden updates', async () => {
    await seedActiveAccount(env!, {
      uid: 'muni-admin-1',
      role: 'municipal_admin',
      municipalityId: 'daet',
    })
    const db = authed(
      env,
      'muni-admin-1',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'situation_updates/seed-hidden')))
  })

  itif('allows signed-in users to report a public update for moderation', async () => {
    const db = authed(env, 'citizen-1', {})
    await assertSucceeds(
      addDoc(collection(db, 'situation_updates/seed-public/reports'), {
        reporterUid: 'citizen-1',
        reason: 'misleading location',
        createdAt: ts,
      }),
    )
  })

  itif('rejects moderation reports for another uid', async () => {
    const db = authed(env, 'citizen-2', {})
    await assertFails(
      addDoc(collection(db, 'situation_updates/seed-public/reports'), {
        reporterUid: 'citizen-1',
        reason: 'misleading location',
        createdAt: ts,
      }),
    )
  })

  itif('allows superadmin to read moderation reports', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'situation_updates/seed-public/reports/report-1'), {
        reporterUid: 'citizen-1',
        reason: 'misleading location',
        createdAt: ts,
      })
    })
    const db = authed(
      env,
      'admin-1',
      staffClaims({ role: 'provincial_superadmin', permittedMunicipalityIds: [] }),
    )
    await assertSucceeds(getDoc(doc(db, 'situation_updates/seed-public/reports/report-1')))
  })
})
