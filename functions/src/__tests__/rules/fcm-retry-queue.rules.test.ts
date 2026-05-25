import { assertFails } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc, getDoc } from 'firebase/firestore'
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
  env = await createTestEnvSafe('demo-fcm-retry-queue')
  if (!env) return
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('fcm_retry_queue rules', () => {
  itif(!!env)('rejects all writes', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(
      setDoc(doc(db, 'fcm_retry_queue', 'retry-1'), {
        uid: 'responder-1',
        attempt: 1,
        createdAt: Date.now(),
      }),
    )
  })

  itif(!!env)('rejects all reads', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'fcm_retry_queue', 'retry-1')))
  })
})
