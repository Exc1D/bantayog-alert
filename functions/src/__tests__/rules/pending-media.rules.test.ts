import { assertFails } from '@firebase/rules-unit-testing'
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { setDoc, doc, getDoc } from 'firebase/firestore'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { authed, createTestEnvSafe } from '../helpers/rules-harness.js'
import { seedActiveAccount, staffClaims, ts } from '../helpers/seed-factories.js'

let env: RulesTestEnvironment | undefined

const itif = (condition: boolean) => (condition ? it : it.skip)

beforeAll(async () => {
  env = await createTestEnvSafe('demo-phase-3a-pending-media')
  if (!env) return
  await seedActiveAccount(env, { uid: 'citizen-1', role: 'citizen' })
})

afterAll(async () => {
  await env?.cleanup()
})

describe('pending_media rules', () => {
  itif(!!env)('rejects citizen writes', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(
      setDoc(doc(db, 'pending_media', 'upl-1'), {
        uploadId: 'upl-1',
        storagePath: 'pending/upl-1',
        strippedAt: ts,
        mimeType: 'image/jpeg',
      }),
    )
  })

  itif(!!env)('rejects citizen reads', async () => {
    const db = authed(env, 'citizen-1', staffClaims({ role: 'citizen' }))
    await assertFails(getDoc(doc(db, 'pending_media', 'upl-1')))
  })
})
