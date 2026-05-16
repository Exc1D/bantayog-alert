import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) => (condition ? it : it.skip)

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-2-report-lookup')
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

    await db.collection('report_lookup').doc('pub-ref-1').set({
      publicRef: 'pub-ref-1',
      reportId: 'r-lookup-1',
      createdAt: 1713350400000,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('report_lookup rules', () => {
  itif(!!env)('any authed user reads (positive)', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(getDoc(doc(db, 'report_lookup/pub-ref-1')))
  })

  itif(!!env)('municipal admin reads (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'report_lookup/pub-ref-1')))
  })

  itif(!!env)('any client write fails', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    const { setDoc } = await import('firebase/firestore')
    await assertFails(setDoc(doc(db, 'report_lookup/new'), { publicRef: 'new', reportId: 'r-new' }))
  })

  itif(!!env)('unauthed read succeeds', async () => {
    const db = unauthed(env)
    await assertSucceeds(getDoc(doc(db, 'report_lookup/pub-ref-1')))
  })

  itif(!!env)('unauthed write fails', async () => {
    const db = unauthed(env)
    const { setDoc } = await import('firebase/firestore')
    await assertFails(setDoc(doc(db, 'report_lookup/new'), { publicRef: 'new', reportId: 'r-new' }))
  })
})
