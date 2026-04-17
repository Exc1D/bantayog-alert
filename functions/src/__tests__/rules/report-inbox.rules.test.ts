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
        payload: { reportType: 'flood', description: 'x', source: 'web' },
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
        payload: { reportType: 'flood', description: 'x' },
      }),
    )
  })

  it('rejects inbox writes missing required keys', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: ts,
        payload: { reportType: 'flood' }, // missing idempotencyKey
      }),
    )
  })

  it('rejects responder-witness inbox submissions (callable-only path)', async () => {
    const db = authed(env, 'resp-1', staffClaims({ role: 'responder' }))
    await assertFails(
      addDoc(collection(db, 'report_inbox'), {
        reporterUid: 'resp-1',
        clientCreatedAt: ts,
        idempotencyKey: 'k3',
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
