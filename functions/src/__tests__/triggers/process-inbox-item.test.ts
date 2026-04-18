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

  it('moves pending_media references into reports/{id}/media', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      await setDoc(doc(ctx.firestore(), 'pending_media', 'upload-x'), {
        uploadId: 'upload-x',
        storagePath: 'pending/upload-x',
        strippedAt: 1713350400000,
        mimeType: 'image/jpeg',
      })
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-3'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-3',
        publicRef: 'd4e5f607',
        secretHash: 'c'.repeat(64),
        correlationId: '44444444-4444-4444-8444-444444444444',
        payload: {
          reportType: 'flood',
          description: 'x',
          severity: 'low',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
          pendingMediaIds: ['upload-x'],
        },
      })
      const result = await processInboxItemCore({
        db,
        inboxId: 'ibx-3',
        now: () => 1713350401000,
      })
      const mediaSnap = await getDoc(
        doc(ctx.firestore(), 'reports', result.reportId, 'media', 'upload-x'),
      )
      expect(mediaSnap.exists()).toBe(true)
      expect(mediaSnap.data()?.storagePath).toBe('pending/upload-x')
      const pendingSnap = await getDoc(doc(ctx.firestore(), 'pending_media', 'upload-x'))
      expect(pendingSnap.exists()).toBe(false)
    })
  })

  it('writes moderation_incident and throws when payload schema is invalid', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-schema-bad'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-schema-bad',
        publicRef: 'c3d4e5f6',
        secretHash: 'f'.repeat(64),
        correlationId: '33333333-3333-4333-8333-333333333333',
        payload: {
          reportType: 'flood',
          // missing required fields — severity and source omitted
          description: 'bad',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })

      await expect(
        processInboxItemCore({ db, inboxId: 'ibx-schema-bad', now: () => 1713350401000 }),
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })

      const incidentSnap = await getDoc(
        doc(ctx.firestore(), 'moderation_incidents', 'ibx-schema-bad'),
      )
      expect(incidentSnap.exists()).toBe(true)
      expect(incidentSnap.data()?.reason).toBe('schema_invalid')
    })
  })

  it('writes moderation_incident and throws when location is out of jurisdiction', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-oog'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-oog',
        publicRef: 'd4e5f6a7',
        secretHash: 'f'.repeat(64),
        correlationId: '44444444-4444-4444-8444-444444444444',
        payload: {
          reportType: 'flood',
          description: 'somewhere far',
          severity: 'high',
          source: 'web',
          publicLocation: { lat: 0.0, lng: 0.0 }, // way outside Camarines Norte
        },
      })

      await expect(
        processInboxItemCore({ db, inboxId: 'ibx-oog', now: () => 1713350401000 }),
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })

      const incidentSnap = await getDoc(doc(ctx.firestore(), 'moderation_incidents', 'ibx-oog'))
      expect(incidentSnap.exists()).toBe(true)
      expect(incidentSnap.data()?.reason).toBe('out_of_jurisdiction')
    })
  })

  it('throws NOT_FOUND when inbox doc does not exist', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      await expect(
        processInboxItemCore({ db, inboxId: 'ibx-missing', now: () => 1713350401000 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  it('throws CONFLICT when lookup doc exists with different reportId', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      // Pre-write a conflicting lookup entry
      await setDoc(doc(ctx.firestore(), 'report_lookup', 'conflict-ref'), {
        reportId: 'some-other-report',
        tokenHash: 'f'.repeat(64),
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        schemaVersion: 1,
      })
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-conflict'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-conflict',
        publicRef: 'conflict-ref',
        secretHash: 'f'.repeat(64),
        correlationId: '55555555-5555-4555-8555-555555555555',
        payload: {
          reportType: 'flood',
          description: 'conflict test',
          severity: 'high',
          source: 'web',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })

      await expect(
        processInboxItemCore({ db, inboxId: 'ibx-conflict', now: () => 1713350401000 }),
      ).rejects.toMatchObject({ code: 'CONFLICT' })
    })
  })
})
