import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedReport, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('report-messages-rules-test')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'bfp-admin',
    role: 'agency_admin',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
  })
  await seedReport(env, 'report-1', {
    municipalityId: 'daet',
    opsOverrides: { municipalityId: 'daet', agencyIds: ['bfp-daet'] },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'reports', 'report-1', 'messages', 'msg-1'), {
      authorUid: 'daet-admin',
      body: 'Seed message',
      createdAt: ts,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('reports/messages rules', () => {
  it('allows muni admin to read a message', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports', 'report-1', 'messages', 'msg-1')))
  })

  it('allows agency admin to read a message when report_ops agencyIds includes their agency', async () => {
    const db = authed(
      env,
      'bfp-admin',
      staffClaims({ role: 'agency_admin', municipalityId: 'daet', agencyId: 'bfp-daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports', 'report-1', 'messages', 'msg-1')))
  })

  it('allows muni admin to write a message', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      addDoc(collection(db, 'reports', 'report-1', 'messages'), {
        authorUid: 'daet-admin',
        body: 'En route.',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  it('denies muni admin from writing to another report municipality', async () => {
    await seedReport(env, 'report-2', {
      municipalityId: 'mercedes',
      opsOverrides: { municipalityId: 'mercedes' },
    })

    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(
      addDoc(collection(db, 'reports', 'report-2', 'messages'), {
        authorUid: 'daet-admin',
        body: 'Out of scope.',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  it('denies citizen writes to messages', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(
      addDoc(collection(db, 'reports', 'report-1', 'messages'), {
        authorUid: 'citizen-1',
        body: 'hi',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  it('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'reports', 'report-1', 'messages', 'msg-1')))
  })
})
