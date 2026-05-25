/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { serverTimestamp } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) =>
  condition ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ||
  process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? it
    : it.skip

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-3c-responder')
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
})

afterAll(async () => {
  await env?.cleanup()
})

describe('responder direct-write on dispatches/{id}', () => {
  itif(!!env)('allows assigned responder to transition accepted → acknowledged', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
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
        lastStatusAt: serverTimestamp(),
      }),
    )
  })

  itif(!!env)('denies acknowledged → resolved (skipping en_route/on_scene)', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'dispatches/d-2'), {
        status: 'acknowledged',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        lastStatusAt: Date.now(),
      })
    })

    const authedDb = authed(env, 'resp-1', {
      role: 'responder',
      municipalityId: 'daet',
      agencyId: 'bfp',
    })
    await assertFails(
      setDoc(doc(authedDb, 'dispatches/d-2'), { status: 'resolved' }, { merge: true }),
    )
  })

  itif(!!env)('denies acknowledged → pending (invalid reverse transition)', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      await setDoc(doc(db, 'dispatches/d-3'), {
        status: 'acknowledged',
        assignedTo: { uid: 'resp-1', agencyId: 'bfp', municipalityId: 'daet' },
        municipalityId: 'daet',
        lastStatusAt: Date.now(),
      })
    })

    const authedDb = authed(env, 'resp-1', {
      role: 'responder',
      municipalityId: 'daet',
      agencyId: 'bfp',
    })
    await assertFails(
      setDoc(doc(authedDb, 'dispatches/d-3'), { status: 'pending' }, { merge: true }),
    )
  })

  itif(!!env)('denies on_scene → resolved without resolutionSummary', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
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
        lastStatusAt: serverTimestamp(),
      }),
    )
  })

  itif(!!env)('allows on_scene → resolved with resolutionSummary', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
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
        lastStatusAt: serverTimestamp(),
        resolutionSummary: 'Secured the area, no injuries reported.',
      }),
    )
  })

  itif(!!env)('denies writes by a different responder', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
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
    await seedActiveAccount(env!, {
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
        .update({ status: 'acknowledged', lastStatusAt: serverTimestamp() }),
    )
  })

  itif(!!env)('denies writes that touch fields outside the allowlist', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
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
          lastStatusAt: serverTimestamp(),
          assignedTo: { uid: 'someone-else', agencyId: 'bfp', municipalityId: 'daet' },
        }),
    )
  })
})
