import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, deleteDoc, collection } from 'firebase/firestore'
import { getTestEnv } from './setup'
import { citizenCtx, unauthCtx } from './helpers'

describe('report_inbox rules', () => {
  let testEnv: Awaited<ReturnType<typeof getTestEnv>>

  beforeAll(async () => {
    testEnv = await getTestEnv()
  })
  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  // --- Positive tests ---

  it('should allow citizen to create a valid inbox item', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertSucceeds(
      setDoc(ref, {
        reporterUid: 'citizen_1',
        clientCreatedAt: new Date(),
        payload: {
          type: 'flood',
          description: 'Water rising',
          municipalityId: 'daet',
          barangayId: 'calasgasan',
          locationPrecision: 'gps',
        },
        idempotencyKey: 'idem_1',
      }),
    )
  })

  // --- Negative tests ---

  it('should reject unauthenticated create', async () => {
    const ctx = unauthCtx(testEnv)
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertFails(
      setDoc(ref, {
        reporterUid: 'anon',
        clientCreatedAt: new Date(),
        payload: {
          type: 'flood',
          description: 'test',
          municipalityId: 'daet',
          barangayId: 'x',
          locationPrecision: 'gps',
        },
        idempotencyKey: 'idem_1',
      }),
    )
  })

  it('should reject create with mismatched reporterUid', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertFails(
      setDoc(ref, {
        reporterUid: 'citizen_OTHER',
        clientCreatedAt: new Date(),
        payload: {
          type: 'flood',
          description: 'test',
          municipalityId: 'daet',
          barangayId: 'x',
          locationPrecision: 'gps',
        },
        idempotencyKey: 'idem_1',
      }),
    )
  })

  it('should reject create missing required fields', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertFails(
      setDoc(ref, {
        reporterUid: 'citizen_1',
        payload: { type: 'flood' },
      }),
    )
  })

  it('should reject create with responder_witness source', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()
    const ref = doc(collection(db, 'report_inbox'))

    await assertFails(
      setDoc(ref, {
        reporterUid: 'citizen_1',
        clientCreatedAt: new Date(),
        payload: {
          type: 'flood',
          description: 'test',
          municipalityId: 'daet',
          barangayId: 'x',
          locationPrecision: 'gps',
          source: 'responder_witness',
        },
        idempotencyKey: 'idem_1',
      }),
    )
  })

  it('should reject read on report_inbox', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()

    await assertFails(getDoc(doc(db, 'report_inbox', 'any_id')))
  })

  it('should reject delete on report_inbox', async () => {
    const ctx = citizenCtx(testEnv, 'citizen_1')
    const db = ctx.firestore()

    await assertFails(deleteDoc(doc(db, 'report_inbox', 'any_id')))
  })
})
