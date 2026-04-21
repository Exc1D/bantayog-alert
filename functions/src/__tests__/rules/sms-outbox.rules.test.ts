import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules')

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: `phase-4a-sms-outbox-rules-${String(Date.now())}`,
    firestore: { rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8') },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
})

describe('sms_outbox rules', () => {
  it('denies unauthenticated reads', async () => {
    const ctx = testEnv.unauthenticatedContext()
    await assertFails(ctx.firestore().collection('sms_outbox').doc('x').get())
  })

  it('denies citizen reads', async () => {
    const ctx = testEnv.authenticatedContext('u1', { role: 'citizen' })
    await assertFails(ctx.firestore().collection('sms_outbox').doc('x').get())
  })

  it('denies responder reads', async () => {
    const ctx = testEnv.authenticatedContext('r1', { role: 'responder', active: true })
    await assertFails(ctx.firestore().collection('sms_outbox').doc('x').get())
  })

  it('denies municipal_admin reads (callable-only in 4a)', async () => {
    const ctx = testEnv.authenticatedContext('a1', {
      role: 'municipal_admin',
      municipalityId: 'm1',
      active: true,
    })
    await assertFails(ctx.firestore().collection('sms_outbox').doc('x').get())
  })

  it('denies provincial_superadmin reads (callable-only in 4a)', async () => {
    const ctx = testEnv.authenticatedContext('s1', {
      role: 'provincial_superadmin',
      active: true,
    })
    await assertFails(ctx.firestore().collection('sms_outbox').doc('x').get())
  })

  it('denies ALL client writes', async () => {
    const ctx = testEnv.authenticatedContext('a1', { role: 'municipal_admin', active: true })
    await assertFails(ctx.firestore().collection('sms_outbox').doc('x').set({ status: 'queued' }))
  })
})
