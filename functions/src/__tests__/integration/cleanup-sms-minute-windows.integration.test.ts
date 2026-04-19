import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { cleanupSmsMinuteWindowsCore } from '../../triggers/cleanup-sms-minute-windows.js'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: `phase-4a-clean-${Date.now().toString()}`,
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

describe('cleanupSmsMinuteWindowsCore', () => {
  it('deletes windows older than 1h, retains newer ones, paginates over 500-doc batches', async () => {
    const db = getFirestore()
    const now = Date.now()

    // 600 old (older than 1h), 50 recent
    const batch = db.batch()
    for (let i = 0; i < 600; i++) {
      const startMs = now - 2 * 60 * 60 * 1000 - i * 60_000
      const id = String(20_000_000_000_0000 + i)
      batch.set(
        db.collection('sms_provider_health').doc('semaphore').collection('minute_windows').doc(id),
        {
          providerId: 'semaphore',
          windowStartMs: startMs,
          attempts: 1,
          failures: 0,
          rateLimitedCount: 0,
          latencySumMs: 0,
          maxLatencyMs: 0,
          updatedAt: startMs,
          schemaVersion: 1,
        },
      )
      if ((i + 1) % 400 === 0) {
        await batch.commit()
      }
    }
    await batch.commit()

    const recentBatch = db.batch()
    for (let i = 0; i < 50; i++) {
      const startMs = now - i * 60_000
      const id = `recent-${i.toString()}`
      recentBatch.set(
        db.collection('sms_provider_health').doc('semaphore').collection('minute_windows').doc(id),
        {
          providerId: 'semaphore',
          windowStartMs: startMs,
          attempts: 1,
          failures: 0,
          rateLimitedCount: 0,
          latencySumMs: 0,
          maxLatencyMs: 0,
          updatedAt: startMs,
          schemaVersion: 1,
        },
      )
    }
    await recentBatch.commit()

    await cleanupSmsMinuteWindowsCore({ db, now: () => now })

    const remaining = await db
      .collection('sms_provider_health')
      .doc('semaphore')
      .collection('minute_windows')
      .get()
    expect(remaining.size).toBe(50)
  }, 30_000)
})
