import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { reconcileSmsDeliveryStatusCore } from '../../triggers/reconcile-sms-delivery-status.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: `phase-4a-rec-${Date.now().toString()}`,
    firestore: {
      rules:
        'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}',
    },
  })
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  if (getApps().length === 0) initializeApp({ projectId: testEnv.projectId })
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

function baseOutbox(id: string, overrides: Record<string, unknown> = {}) {
  return {
    providerId: 'semaphore',
    recipientMsisdnHash: 'a'.repeat(64),
    recipientMsisdn: '+639171234567',
    purpose: 'receipt_ack',
    predictedEncoding: 'GSM-7',
    predictedSegmentCount: 1,
    bodyPreviewHash: 'b'.repeat(64),
    status: 'queued',
    idempotencyKey: id,
    retryCount: 0,
    locale: 'tl',
    reportId: 'r1',
    createdAt: Date.now() - 60 * 60 * 1000,
    queuedAt: Date.now() - 31 * 60 * 1000,
    schemaVersion: 2,
    ...overrides,
  }
}

describe('reconcileSmsDeliveryStatusCore', () => {
  it('marks queued row older than 30m as abandoned with orphan reason', async () => {
    const now = Date.now()
    const db = getFirestore()
    await db
      .collection('sms_outbox')
      .doc('orphan-1')
      .set(baseOutbox('orphan-1', { queuedAt: now - 31 * 60 * 1000 }))

    await reconcileSmsDeliveryStatusCore({ db, now: () => now })

    const after = (await db.collection('sms_outbox').doc('orphan-1').get()).data()
    expect(after?.status).toBe('abandoned')
    expect(after?.terminalReason).toBe('orphan')
    expect(after?.abandonedAt).toBeGreaterThan(0)
  })

  it('does not touch queued rows younger than 30m', async () => {
    const now = Date.now()
    const db = getFirestore()
    await db
      .collection('sms_outbox')
      .doc('fresh')
      .set(baseOutbox('fresh', { queuedAt: now - 5 * 60 * 1000 }))
    await reconcileSmsDeliveryStatusCore({ db, now: () => now })
    const after = (await db.collection('sms_outbox').doc('fresh').get()).data()
    expect(after?.status).toBe('queued')
  })

  it('CAS deferred → queued and updates queuedAt to now', async () => {
    const now = Date.now()
    const db = getFirestore()
    await db
      .collection('sms_outbox')
      .doc('def-1')
      .set(
        baseOutbox('def-1', { status: 'deferred', retryCount: 1, queuedAt: now - 10 * 60 * 1000 }),
      )
    await reconcileSmsDeliveryStatusCore({ db, now: () => now })
    const after = (await db.collection('sms_outbox').doc('def-1').get()).data()
    expect(after?.status).toBe('queued')
    expect(after?.queuedAt).toBe(now)
    expect(after?.retryCount).toBe(1)
  })

  it('terminal rows are untouched', async () => {
    const now = Date.now()
    const db = getFirestore()
    await db
      .collection('sms_outbox')
      .doc('done')
      .set(baseOutbox('done', { status: 'delivered', queuedAt: now - 2 * 60 * 60 * 1000 }))
    await reconcileSmsDeliveryStatusCore({ db, now: () => now })
    const after = (await db.collection('sms_outbox').doc('done').get()).data()
    expect(after?.status).toBe('delivered')
  })
})
