import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe, unauthed } from '../helpers/rules-harness.js'
import {
  seedActiveAccount,
  seedDispatchRT,
  seedReport,
  staffClaims,
  ts,
} from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) => (condition ? it : it.skip)

beforeAll(async () => {
  env = await createTestEnvSafe('report-messages-rules-test')
  if (!env) return
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
    await setDoc(doc(ctx.firestore(), 'reports', 'report-1', 'messages', 'msg-1'), {
      authorUid: 'daet-admin',
      body: 'Seed message',
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
  await env?.cleanup()
})

describe('reports/messages rules', () => {
  itif(!!env)('allows muni admin to read a message', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    await assertSucceeds(getDoc(doc(db, 'reports', 'report-1', 'messages', 'msg-1')))
  })

  itif(!!env)(
    'allows agency admin to read a message when report_ops agencyIds includes their agency',
    async () => {
      const db = authed(
        env,
        'bfp-admin',
        staffClaims({ role: 'agency_admin', municipalityId: 'daet', agencyId: 'bfp-daet' }),
      )
      await assertSucceeds(getDoc(doc(db, 'reports', 'report-1', 'messages', 'msg-1')))
    },
  )

  itif(!!env)('allows muni admin to write a message', async () => {
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

  itif(!!env)('denies muni admin from writing to another report municipality', async () => {
    await seedReport(env!, 'report-2', {
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

  itif(!!env)('denies citizen writes to messages', async () => {
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

  itif(!!env)('denies unauthenticated reads', async () => {
    const db = unauthed(env)
    await assertFails(getDoc(doc(db, 'reports', 'report-1', 'messages', 'msg-1')))
  })

  itif(!!env)('allows responder with active dispatch to write a message', async () => {
    const db = authed(
      env,
      'bfp-responder-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp-daet' }),
    )
    await assertSucceeds(
      addDoc(collection(db, 'reports', 'report-1', 'messages'), {
        authorUid: 'bfp-responder-1',
        body: 'On scene.',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  itif(!!env)('denies responder without an active dispatch from writing a message', async () => {
    const db = authed(
      env,
      'bfp-responder-no-dispatch',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp-daet' }),
    )
    await assertFails(
      addDoc(collection(db, 'reports', 'report-1', 'messages'), {
        authorUid: 'bfp-responder-no-dispatch',
        body: 'No dispatch.',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })

  itif(!!env)('denies responder writing message with mismatched authorUid', async () => {
    const db = authed(
      env,
      'bfp-responder-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp-daet' }),
    )
    await assertFails(
      addDoc(collection(db, 'reports', 'report-1', 'messages'), {
        authorUid: 'someone-else',
        body: 'spoofed',
        createdAt: ts,
        schemaVersion: 1,
      }),
    )
  })
})
