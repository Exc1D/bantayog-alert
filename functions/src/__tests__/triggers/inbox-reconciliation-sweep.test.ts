import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { inboxReconciliationSweepCore } from '../../triggers/inbox-reconciliation-sweep.js'

const RULES_PATH = resolve(import.meta.dirname, '../../../../infra/firebase/firestore.rules')

let env: RulesTestEnvironment | undefined
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-3a-sweep',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8') },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'municipalities', 'daet'), {
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.11, lng: 122.95 },
      schemaVersion: 1,
    })
  })
})

afterAll(async () => {
  if (env) await env.cleanup()
})

beforeEach(async () => {
  await env!.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const collections = [
      'report_inbox',
      'reports',
      'report_private',
      'report_ops',
      'report_events',
      'report_lookup',
      'moderation_incidents',
      'idempotency_keys',
      'pending_media',
    ]
    for (const col of collections) {
      const docs = await db.collection(col).get()
      for (const d of docs.docs) {
        await d.ref.delete()
      }
    }
  })
})

describe('inboxReconciliationSweepCore', () => {
  it('picks up unprocessed inbox items older than the threshold', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      const now = 1713350500000
      // Stale (3 min old, unprocessed) — above 2 min threshold
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'stale-1'), {
        reporterUid: 'c-1',
        clientCreatedAt: now - 3 * 60 * 1000,
        idempotencyKey: 'idem-s',
        publicRef: 'sss11111',
        secretHash: 'a'.repeat(64),
        correlationId: '55555555-5555-4555-8555-555555555555',
        payload: {
          reportType: 'flood',
          description: 'x',
          severity: 'low',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })
      // Fresh (unprocessed, under 2 min)
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'fresh-1'), {
        reporterUid: 'c-1',
        clientCreatedAt: now - 30 * 1000,
        idempotencyKey: 'idem-f',
        publicRef: 'fff11111',
        secretHash: 'b'.repeat(64),
        correlationId: '66666666-6666-4666-8666-666666666666',
        payload: {
          reportType: 'flood',
          description: 'x',
          severity: 'low',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })

      const result = await inboxReconciliationSweepCore({ db, now: () => now })
      expect(result.processed).toBe(1)

      const stale = await getDoc(doc(ctx.firestore(), 'report_inbox', 'stale-1'))
      expect(stale.data()?.processedAt).toBeDefined()
      const fresh = await getDoc(doc(ctx.firestore(), 'report_inbox', 'fresh-1'))
      expect(fresh.data()?.processedAt).toBeUndefined()
    })
  })
})
