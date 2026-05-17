import { type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { guardInitTestEnvironment } from '../helpers/emulator-guard.js'
import { inboxReconciliationSweepCore } from '../../triggers/inbox-reconciliation-sweep.js'

const RULES_PATH = resolve(import.meta.dirname, '../../../../infra/firebase/firestore.rules')

let env: RulesTestEnvironment | undefined
let emulatorAvailable = false

beforeAll(async () => {
  const guarded = await guardInitTestEnvironment(
    {
      projectId: 'demo-3a-sweep',
      firestore: { host: '127.0.0.1', port: 8081, rules: readFileSync(RULES_PATH, 'utf8') },
    },
    'inbox-reconciliation-sweep',
  )
  env = guarded.env
  emulatorAvailable = guarded.available
  if (!emulatorAvailable || !env) return

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

const itif = (condition: boolean) => (condition ? it : it.skip)

afterAll(async () => {
  if (env) await env.cleanup()
})

beforeEach(async () => {
  if (!emulatorAvailable || !env) return
  await env.withSecurityRulesDisabled(async (ctx) => {
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
  itif(emulatorAvailable)('picks up unprocessed inbox items older than the threshold', async () => {
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

  itif(emulatorAvailable)(
    'does not mark transient materialization failures as processed',
    async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        const now = 1713350500000
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'stale-failed'), {
          reporterUid: 'c-1',
          clientCreatedAt: now - 3 * 60 * 1000,
          idempotencyKey: 'idem-failed',
          publicRef: 'bad11111',
          secretHash: 'c'.repeat(64),
          correlationId: '77777777-7777-4777-8777-777777777777',
          payload: {
            reportType: 'flood',
            description: 'x',
            severity: 'low',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
          },
        })

        const result = await inboxReconciliationSweepCore({
          db,
          now: () => now,
          processInboxItem: () => Promise.reject(new Error('transient firestore failure')),
        })
        expect(result.failed).toBe(1)

        const stale = await getDoc(doc(ctx.firestore(), 'report_inbox', 'stale-failed'))
        expect(stale.data()?.processedAt).toBeUndefined()
        expect(stale.data()?.processingStartedAt).toBeNull()
        expect(typeof stale.data()?.lastProcessingFailedAt).toBe('number')
        expect(stale.data()?.lastProcessingError).toBe('transient firestore failure')
      })
    },
  )
})
