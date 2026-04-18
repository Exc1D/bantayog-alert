import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { processInboxItemCore } from '../../triggers/process-inbox-item.js'

const RULES_PATH = resolve(import.meta.dirname, '../../../../infra/firebase/firestore.rules')

let env: RulesTestEnvironment | undefined
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-phase-3a-inbox',
    firestore: { rules: readFileSync(RULES_PATH, 'utf8') },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'municipalities', 'daet'), {
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1, lng: 122.95 },
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
    const inboxDocs = await db.collection('report_inbox').get()
    const reportDocs = await db.collection('reports').get()
    for (const d of [...inboxDocs.docs, ...reportDocs.docs]) {
      await d.ref.delete()
    }
  })
})

describe('processInboxItemCore', () => {
  it('materializes a complete triptych + event + lookup from a valid inbox doc', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-1'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-1',
        publicRef: 'a1b2c3d4',
        secretHash: 'f'.repeat(64),
        correlationId: '11111111-1111-4111-8111-111111111111',
        payload: {
          reportType: 'flood',
          description: 'flooded street',
          severity: 'high',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })

      const result = await processInboxItemCore({
        db,
        inboxId: 'ibx-1',
        now: () => 1713350401000,
      })

      expect(result.materialized).toBe(true)
      const reportSnap = await getDoc(doc(ctx.firestore(), 'reports', result.reportId))
      expect(reportSnap.exists()).toBe(true)
      const report = reportSnap.data()
      expect(report?.status).toBe('new')
      expect(report?.municipalityId).toBe('daet')
      expect(report?.municipalityLabel).toBe('Daet')
      expect(report?.correlationId).toBe('11111111-1111-4111-8111-111111111111')

      const privateSnap = await getDoc(doc(ctx.firestore(), 'report_private', result.reportId))
      expect(privateSnap.exists()).toBe(true)
      expect(privateSnap.data()?.reporterUid).toBe('citizen-1')

      const opsSnap = await getDoc(doc(ctx.firestore(), 'report_ops', result.reportId))
      expect(opsSnap.exists()).toBe(true)

      const lookupSnap = await getDoc(doc(ctx.firestore(), 'report_lookup', 'a1b2c3d4'))
      expect(lookupSnap.exists()).toBe(true)
      expect(lookupSnap.data()?.reportId).toBe(result.reportId)
      expect(lookupSnap.data()?.tokenHash).toBe('f'.repeat(64))
    })
  })

  it('is idempotent — second invocation is a no-op', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-2'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-2',
        publicRef: 'b2c3d4e5',
        secretHash: 'e'.repeat(64),
        correlationId: '22222222-2222-4222-8222-222222222222',
        payload: {
          reportType: 'landslide',
          description: 'debris on road',
          severity: 'medium',
          source: 'mobile',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })

      const first = await processInboxItemCore({
        db,
        inboxId: 'ibx-2',
        now: () => 1713350401000,
      })
      expect(first.materialized).toBe(true)

      const second = await processInboxItemCore({
        db,
        inboxId: 'ibx-2',
        now: () => 1713350402000,
      })
      expect(second.materialized).toBe(false)
      expect(second.reportId).toBe(first.reportId)
    })
  })
})
