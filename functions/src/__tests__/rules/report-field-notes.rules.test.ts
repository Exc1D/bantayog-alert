import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import {
  seedActiveAccount,
  seedDispatchRT,
  seedReport,
  staffClaims,
  ts,
} from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('report-field-notes-rules-test')
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  await seedActiveAccount(env, {
    uid: 'bfp-responder-1',
    role: 'responder',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
  })
  await seedActiveAccount(env, {
    uid: 'bfp-responder-no-dispatch',
    role: 'responder',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
  })
  await seedReport(env, 'report-1', {
    municipalityId: 'daet',
    opsOverrides: { municipalityId: 'daet', agencyIds: ['bfp-daet'] },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'reports', 'report-1', 'field_notes', 'note-1'), {
      authorUid: 'bfp-responder-1',
      authorRole: 'responder',
      authorDisplayName: 'BFP Responder 01',
      body: 'Seed note',
      createdAt: ts,
      schemaVersion: 1,
    })
  })
  await seedDispatchRT(env, 'report-1_bfp-responder-1', {
    reportId: 'report-1',
    assignedTo: { uid: 'bfp-responder-1', agencyId: 'bfp-daet', municipalityId: 'daet' },
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('reports/field_notes rules', () => {
  it('allows muni admin to read a field note', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports', 'report-1', 'field_notes', 'note-1')))
  })

  it('allows responder with active dispatch to read a field note', async () => {
    const db = authed(
      env,
      'bfp-responder-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp-daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports', 'report-1', 'field_notes', 'note-1')))
  })

  it('allows responder with active dispatch to create a field note', async () => {
    const db = authed(
      env,
      'bfp-responder-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp-daet' }),
    )
    await assertSucceeds(
      addDoc(collection(db, 'reports', 'report-1', 'field_notes'), {
        authorUid: 'bfp-responder-1',
        authorRole: 'responder',
        authorDisplayName: 'BFP Responder 01',
        body: 'Water is rising fast.',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  it('denies responder without an active dispatch from creating a field note', async () => {
    const db = authed(
      env,
      'bfp-responder-no-dispatch',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp-daet' }),
    )
    await assertFails(
      addDoc(collection(db, 'reports', 'report-1', 'field_notes'), {
        authorUid: 'bfp-responder-no-dispatch',
        authorRole: 'responder',
        authorDisplayName: 'No Dispatch',
        body: 'Should fail',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  it('denies responder writing field note with mismatched authorUid', async () => {
    const db = authed(
      env,
      'bfp-responder-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp-daet' }),
    )
    await assertFails(
      addDoc(collection(db, 'reports', 'report-1', 'field_notes'), {
        authorUid: 'someone-else',
        authorRole: 'responder',
        authorDisplayName: 'Spoofed',
        body: 'spoofed',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  it('denies citizen reads', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'reports', 'report-1', 'field_notes', 'note-1')))
  })

  it('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'reports', 'report-1', 'field_notes', 'note-1')))
  })
})
