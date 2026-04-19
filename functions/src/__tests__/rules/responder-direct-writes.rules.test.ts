/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-3c-responder')
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
})

afterAll(async () => {
  await env.cleanup()
})

describe('responder direct-write on dispatches/{id}', () => {
  it('allows assigned responder to transition accepted → acknowledged', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'dispatches/dispatch-1'), {
        status: 'accepted',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        lastStatusAt: Date.now(),
        acknowledgementDeadlineAt: Date.now() + 900000,
        reportId: 'report-1',
        dispatchedBy: 'daet-admin',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: Date.now(),
        idempotencyKey: 'key-1',
        idempotencyPayloadHash: 'a'.repeat(64),
        schemaVersion: 1,
      })
    })
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertSucceeds(
      db.collection('dispatches').doc('dispatch-1').update({
        status: 'acknowledged',
        lastStatusAt: FieldValue.serverTimestamp(),
      }),
    )
  })

  it('denies acknowledged → resolved (skipping en_route/on_scene)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'dispatches/dispatch-2'), {
        status: 'acknowledged',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        lastStatusAt: Date.now(),
        acknowledgementDeadlineAt: Date.now() + 900000,
        reportId: 'report-2',
        dispatchedBy: 'daet-admin',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: Date.now(),
        idempotencyKey: 'key-2',
        idempotencyPayloadHash: 'b'.repeat(64),
        schemaVersion: 1,
      })
    })
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(
      db
        .collection('dispatches')
        .doc('dispatch-2')
        .update({ status: 'resolved', lastStatusAt: FieldValue.serverTimestamp() }),
    )
  })

  it('denies on_scene → resolved without resolutionSummary', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'dispatches/dispatch-3'), {
        status: 'on_scene',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        lastStatusAt: Date.now(),
        acknowledgementDeadlineAt: Date.now() + 900000,
        reportId: 'report-3',
        dispatchedBy: 'daet-admin',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: Date.now(),
        idempotencyKey: 'key-3',
        idempotencyPayloadHash: 'c'.repeat(64),
        schemaVersion: 1,
      })
    })
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(
      db.collection('dispatches').doc('dispatch-3').update({
        status: 'resolved',
        lastStatusAt: FieldValue.serverTimestamp(),
      }),
    )
  })

  it('allows on_scene → resolved with resolutionSummary', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'dispatches/dispatch-4'), {
        status: 'on_scene',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        lastStatusAt: Date.now(),
        acknowledgementDeadlineAt: Date.now() + 900000,
        reportId: 'report-4',
        dispatchedBy: 'daet-admin',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: Date.now(),
        idempotencyKey: 'key-4',
        idempotencyPayloadHash: 'd'.repeat(64),
        schemaVersion: 1,
      })
    })
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertSucceeds(
      db.collection('dispatches').doc('dispatch-4').update({
        status: 'resolved',
        lastStatusAt: FieldValue.serverTimestamp(),
        resolutionSummary: 'Secured the area, no injuries reported.',
      }),
    )
  })

  it('denies writes by a different responder', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'dispatches/dispatch-5'), {
        status: 'accepted',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        lastStatusAt: Date.now(),
        acknowledgementDeadlineAt: Date.now() + 900000,
        reportId: 'report-5',
        dispatchedBy: 'daet-admin',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: Date.now(),
        idempotencyKey: 'key-5',
        idempotencyPayloadHash: 'e'.repeat(64),
        schemaVersion: 1,
      })
    })
    const strangerUid = 'other-responder'
    await seedActiveAccount(env, {
      uid: strangerUid,
      role: 'responder',
      municipalityId: 'daet',
      agencyId: 'bfp',
    })
    const db = authed(
      env,
      strangerUid,
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(
      db
        .collection('dispatches')
        .doc('dispatch-5')
        .update({ status: 'acknowledged', lastStatusAt: FieldValue.serverTimestamp() }),
    )
  })

  it('denies writes that touch fields outside the allowlist', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'dispatches/dispatch-6'), {
        status: 'accepted',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        lastStatusAt: Date.now(),
        acknowledgementDeadlineAt: Date.now() + 900000,
        reportId: 'report-6',
        dispatchedBy: 'daet-admin',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: Date.now(),
        idempotencyKey: 'key-6',
        idempotencyPayloadHash: 'f'.repeat(64),
        schemaVersion: 1,
      })
    })
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', municipalityId: 'daet', agencyId: 'bfp' }),
    )
    await assertFails(
      db
        .collection('dispatches')
        .doc('dispatch-6')
        .update({
          status: 'acknowledged',
          lastStatusAt: FieldValue.serverTimestamp(),
          assignedTo: { uid: 'someone-else', agencyId: 'bfp', municipalityId: 'daet' },
        }),
    )
  })
})
