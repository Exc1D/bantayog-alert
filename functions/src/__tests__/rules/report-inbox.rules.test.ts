import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, setDoc, doc, getDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv, unauthed } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-inbox')
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedActiveAccount(env, {
    uid: 'resp-1',
    role: 'responder',
    agencyId: 'bfp',
    municipalityId: 'daet',
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('report_inbox rules', () => {
  it('allows an authed citizen to create their own inbox entry', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertSucceeds(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k1',
        publicRef: 'a1b2c3d4',
        secretHash: 'f'.repeat(64),
        correlationId: '11111111-1111-4111-8111-111111111111',
        payload: { reportType: 'flood', description: 'x', source: 'web' },
      }),
    )
  })

  it('allows an anonymous authed user to create their own inbox entry', async () => {
    const db = authed(env, 'anon-1', {})
    await assertSucceeds(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'anon-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k-anon',
        publicRef: 'b2c3d4e5',
        secretHash: 'a'.repeat(64),
        correlationId: '22222222-2222-4222-8222-222222222222',
        payload: { reportType: 'fire', description: 'y', source: 'web' },
      }),
    )
  })

  it('rejects inbox writes where reporterUid does not match the caller', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-2',
        clientCreatedAt: ts,
        idempotencyKey: 'k2',
        publicRef: 'c3d4e5f6',
        secretHash: 'b'.repeat(64),
        correlationId: '33333333-3333-4333-8333-333333333333',
        payload: { reportType: 'flood', description: 'x' },
      }),
    )
  })

  it('rejects inbox writes missing required keys', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    // Missing secretHash and correlationId — hasAll will reject
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k2',
        publicRef: 'c3d4e5f6',
        payload: { reportType: 'flood', description: 'x', source: 'web' },
      }),
    )
  })

  it('allows responder inbox submissions (any authenticated user)', async () => {
    const db = authed(env, 'resp-1', staffClaims({ role: 'responder' }))
    await assertSucceeds(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'resp-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k3',
        publicRef: 'd4e5f6g7',
        secretHash: 'c'.repeat(64),
        correlationId: '44444444-4444-4444-8444-444444444444',
        payload: { reportType: 'flood', source: 'responder_witness', description: 'x' },
      }),
    )
  })

  it('rejects unauthenticated writes', async () => {
    const db = unauthed(env)
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k4',
        publicRef: 'e5f6g7h8',
        secretHash: 'd'.repeat(64),
        correlationId: '55555555-5555-4555-8555-555555555555',
        payload: { reportType: 'flood', description: 'x' },
      }),
    )
  })

  it('rejects reads from any role including the creator', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'inbox-1'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k',
        payload: {},
      })
    })
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'report_inbox/inbox-1')))
  })
})
