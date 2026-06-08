import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedReport, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

beforeAll(async () => {
  env = await createTestEnvSafe('mvp-loop-rules')
  if (!env) return

  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedActiveAccount(env, { uid: 'citizen-2', role: 'citizen' })
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
    municipalityId: 'daet',
    agencyId: 'bfp',
  })

  await seedReport(env, 'mvp-report', {
    municipalityId: 'daet',
    status: 'verified',
    visibilityClass: 'internal',
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'report_lookup', 'mvp-ref-1'), {
      publicRef: 'mvp-ref-1',
      reportId: 'mvp-report',
      createdAt: ts,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('MVP Firestore rules spine', () => {
  it('reporter can read their own internal report for citizen tracking', async ({ skip }) => {
    if (!env) return skip('Emulator init failed')
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(getDoc(doc(db, 'reports/mvp-report')))
  })

  it('another citizen cannot read someone else internal report', async ({ skip }) => {
    if (!env) return skip('Emulator init failed')
    const db = authed(env, 'citizen-2', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'reports/mvp-report')))
  })

  it('public report lookup is read-only for anonymous tracking recovery', async ({ skip }) => {
    if (!env) return skip('Emulator init failed')
    const db = unauthed(env)
    await assertSucceeds(getDoc(doc(db, 'report_lookup/mvp-ref-1')))
    await assertFails(
      setDoc(doc(db, 'report_lookup/mvp-ref-2'), {
        publicRef: 'mvp-ref-2',
        reportId: 'mvp-report',
      }),
    )
  })

  it('municipal admin can query verified in-scope reports for assignment', async ({ skip }) => {
    if (!env) return skip('Emulator init failed')
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )

    await assertSucceeds(
      getDocs(
        query(
          collection(db, 'reports'),
          where('municipalityId', '==', 'daet'),
          where('status', '==', 'verified'),
        ),
      ),
    )
  })

  it('direct dispatch creation is denied because assignment is callable-only', async ({ skip }) => {
    if (!env) return skip('Emulator init failed')
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )

    await assertFails(
      setDoc(doc(db, 'dispatches/mvp-report_resp-1'), {
        dispatchId: 'mvp-report_resp-1',
        reportId: 'mvp-report',
        municipalityId: 'daet',
        status: 'pending',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        dispatchedAt: ts,
        lastStatusAt: ts,
        schemaVersion: 1,
      }),
    )
  })
})
