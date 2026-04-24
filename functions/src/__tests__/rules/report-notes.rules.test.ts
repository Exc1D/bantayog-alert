import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, getDocs } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, seedReport, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('report-notes-rules-test')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'other-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  await seedReport(env, 'report-daet', {
    municipalityId: 'daet',
    opsOverrides: { municipalityId: 'daet' },
  })
  await seedReport(env, 'report-mercedes', {
    municipalityId: 'mercedes',
    opsOverrides: { municipalityId: 'mercedes' },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await addDoc(collection(ctx.firestore(), 'report_notes'), {
      reportId: 'report-daet',
      authorUid: 'daet-admin',
      body: 'Seed note',
      createdAt: ts,
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

const validNote = {
  reportId: 'report-daet',
  authorUid: 'daet-admin',
  body: 'Situation is stable.',
  createdAt: ts,
  schemaVersion: 1,
}

describe('report_notes rules', () => {
  it('allows muni admin to write note with matching authorUid and municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(addDoc(collection(db, 'report_notes'), validNote))
  })

  it('denies muni admin writing note with mismatched authorUid', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(
      addDoc(collection(db, 'report_notes'), { ...validNote, authorUid: 'other-admin' }),
    )
  })

  it('denies muni admin writing note for a report in a different municipality', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertFails(
      addDoc(collection(db, 'report_notes'), {
        ...validNote,
        reportId: 'report-mercedes',
      }),
    )
  })

  it('denies citizen writes', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(addDoc(collection(db, 'report_notes'), validNote))
  })

  it('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDocs(collection(db, 'report_notes')))
  })

  it('allows muni admin to read notes', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDocs(collection(db, 'report_notes')))
  })
})
