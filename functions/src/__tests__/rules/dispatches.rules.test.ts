import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-dispatches')

  // Responder who owns d-1
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
  // Responder from a different agency (red-cross)
  await seedActiveAccount(env, {
    uid: 'resp-2',
    role: 'responder',
    agencyId: 'red-cross',
    municipalityId: 'daet',
  })
  // Municipal admin of daet
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
  // Municipal admin of mercedes (other muni)
  await seedActiveAccount(env, {
    uid: 'mercedes-admin',
    role: 'municipal_admin',
    municipalityId: 'mercedes',
  })
  // Agency admin for bfp
  await seedActiveAccount(env, {
    uid: 'bfp-admin',
    role: 'agency_admin',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
  // Agency admin for red-cross (other agency)
  await seedActiveAccount(env, {
    uid: 'redcross-admin',
    role: 'agency_admin',
    agencyId: 'red-cross',
    municipalityId: 'daet',
  })
  // Suspended responder
  await seedActiveAccount(env, {
    uid: 'resp-suspended',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
    accountStatus: 'suspended',
  })

  // Seed a dispatch doc owned by resp-1
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'dispatches/d-1'), {
      reportId: 'r-1',
      responderId: 'resp-1',
      municipalityId: 'daet',
      agencyId: 'bfp',
      dispatchedBy: 'daet-admin',
      dispatchedByRole: 'municipal_admin',
      dispatchedAt: ts,
      status: 'pending',
      statusUpdatedAt: ts,
      acknowledgementDeadlineAt: ts + 180000,
      idempotencyKey: 'k',
      idempotencyPayloadHash: 'a'.repeat(64),
      schemaVersion: 1,
    })
    // accepted dispatch for resp-1 (for accepted→acknowledged test)
    await setDoc(doc(db, 'dispatches/d-2'), {
      reportId: 'r-2',
      responderId: 'resp-1',
      municipalityId: 'daet',
      agencyId: 'bfp',
      dispatchedBy: 'daet-admin',
      dispatchedByRole: 'municipal_admin',
      dispatchedAt: ts,
      status: 'accepted',
      statusUpdatedAt: ts,
      acknowledgementDeadlineAt: ts + 180000,
      idempotencyKey: 'k2',
      idempotencyPayloadHash: 'b'.repeat(64),
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('dispatches rules', () => {
  // --- read tests ---

  it('responder who owns the dispatch reads it (positive)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    const { getDoc } = await import('firebase/firestore')
    await assertSucceeds(getDoc(doc(db, 'dispatches/d-1')))
  })

  it('responder from a different agency reading the dispatch fails', async () => {
    const db = authed(
      env,
      'resp-2',
      staffClaims({ role: 'responder', agencyId: 'red-cross', municipalityId: 'daet' }),
    )
    const { getDoc } = await import('firebase/firestore')
    await assertFails(getDoc(doc(db, 'dispatches/d-1')))
  })

  it('admin-of-muni reads the dispatch (positive)', async () => {
    const db = authed(
      env,
      'daet-admin',
      staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
    )
    const { getDoc } = await import('firebase/firestore')
    await assertSucceeds(getDoc(doc(db, 'dispatches/d-1')))
  })

  it('agency admin whose myAgency() == agencyId reads (positive)', async () => {
    const db = authed(
      env,
      'bfp-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    const { getDoc } = await import('firebase/firestore')
    await assertSucceeds(getDoc(doc(db, 'dispatches/d-1')))
  })

  it('other agency admin fails', async () => {
    const db = authed(
      env,
      'redcross-admin',
      staffClaims({ role: 'agency_admin', agencyId: 'red-cross', municipalityId: 'daet' }),
    )
    const { getDoc } = await import('firebase/firestore')
    await assertFails(getDoc(doc(db, 'dispatches/d-1')))
  })

  // --- update tests ---

  it('responder updates dispatch pending → declined (positive)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'dispatches/d-1'), {
        status: 'declined',
        statusUpdatedAt: ts + 1,
        declineReason: 'unavailable',
      }),
    )
  })

  it('responder updates pending → in_progress fails (not a valid direct transition)', async () => {
    // Reset dispatch to pending first
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { updateDoc: ud } = await import('firebase/firestore')
      await ud(doc(ctx.firestore(), 'dispatches/d-1'), {
        status: 'pending',
        statusUpdatedAt: ts,
      })
    })
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(
      updateDoc(doc(db, 'dispatches/d-1'), { status: 'in_progress', statusUpdatedAt: ts + 1 }),
    )
  })

  it('responder updates accepted → acknowledged (positive)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertSucceeds(
      updateDoc(doc(db, 'dispatches/d-2'), {
        status: 'acknowledged',
        statusUpdatedAt: ts + 1,
        acknowledgedAt: ts + 1,
      }),
    )
  })

  it('responder mutating fields outside affectedKeys() fails (e.g., changing responderId)', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(
      updateDoc(doc(db, 'dispatches/d-2'), {
        status: 'acknowledged',
        statusUpdatedAt: ts + 1,
        responderId: 'resp-2',
      }),
    )
  })

  it("responder writing on another responder's dispatch fails", async () => {
    // Seed a dispatch owned by resp-2
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'dispatches/d-3'), {
        reportId: 'r-3',
        responderId: 'resp-2',
        municipalityId: 'daet',
        agencyId: 'red-cross',
        dispatchedBy: 'daet-admin',
        dispatchedByRole: 'municipal_admin',
        dispatchedAt: ts,
        status: 'pending',
        statusUpdatedAt: ts,
        acknowledgementDeadlineAt: ts + 180000,
        idempotencyKey: 'k3',
        idempotencyPayloadHash: 'c'.repeat(64),
        schemaVersion: 1,
      })
    })
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(
      updateDoc(doc(db, 'dispatches/d-3'), { status: 'declined', statusUpdatedAt: ts + 1 }),
    )
  })

  it('suspended responder fails (active_accounts not active)', async () => {
    const db = authed(
      env,
      'resp-suspended',
      staffClaims({
        role: 'responder',
        agencyId: 'bfp',
        municipalityId: 'daet',
        accountStatus: 'suspended',
      }),
    )
    const { getDoc } = await import('firebase/firestore')
    await assertFails(getDoc(doc(db, 'dispatches/d-1')))
  })

  it('client create always fails', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(
      setDoc(doc(db, 'dispatches/new-d'), {
        reportId: 'r-new',
        responderId: 'resp-1',
        municipalityId: 'daet',
        agencyId: 'bfp',
        status: 'pending',
      }),
    )
  })

  it('client delete always fails', async () => {
    const db = authed(
      env,
      'resp-1',
      staffClaims({ role: 'responder', agencyId: 'bfp', municipalityId: 'daet' }),
    )
    await assertFails(deleteDoc(doc(db, 'dispatches/d-1')))
  })
})
