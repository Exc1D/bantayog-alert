import { assertFails } from '@firebase/rules-unit-testing'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnv } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: Awaited<ReturnType<typeof createTestEnv>>

beforeAll(async () => {
  env = await createTestEnv('demo-phase-2-sms')
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
  await seedActiveAccount(env, {
    uid: 'daet-admin',
    role: 'municipal_admin',
    municipalityId: 'daet',
  })
})

afterAll(async () => {
  await env.cleanup()
})

describe('SMS layer rules', () => {
  describe('sms_inbox', () => {
    it('sms inbox is callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'sms_inbox')))
    })

    it('sms inbox is callable-only writes', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(
        addDoc(collection(db, 'sms_inbox'), {
          providerMessageId: 'msg-1',
          provider: 'semaphore',
          fromNumber: '+1234567890',
          toNumber: '+0987654321',
          receivedAt: ts,
        }),
      )
    })
  })

  describe('sms_outbox', () => {
    it('sms outbox is callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'sms_outbox')))
    })

    it('sms outbox is callable-only writes', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(
        addDoc(collection(db, 'sms_outbox'), {
          toNumber: '+0987654321',
          message: 'test',
          purpose: 'receipt_ack',
          status: 'queued',
          createdAt: ts,
        }),
      )
    })
  })

  describe('sms_sessions (callable)', () => {
    it('sms sessions are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'sms_sessions')))
    })

    it('sms sessions are callable-only writes', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(
        addDoc(collection(db, 'sms_sessions'), {
          provider: 'semaphore',
          sessionKey: 'test',
          expiresAt: ts,
        }),
      )
    })
  })

  describe('sms_provider_health (callable)', () => {
    it('sms provider health are callable-only reads', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(getDocs(collection(db, 'sms_provider_health')))
    })

    it('sms provider health are callable-only writes', async () => {
      const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
      await assertFails(
        addDoc(collection(db, 'sms_provider_health'), {
          provider: 'semaphore',
          isHealthy: true,
          checkedAt: ts,
        }),
      )
    })
  })
})
