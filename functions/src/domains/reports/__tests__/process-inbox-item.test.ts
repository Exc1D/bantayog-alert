import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js'
const itif = (condition: boolean) => (condition ? it : it.skip)
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { processInboxItemCore } from '../process-inbox-item.js'

const PERMISSIVE_RULES =
  'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}'

const { env, available } = await guardInitTestEnvironment(
  {
    projectId: 'demo-phase-3a-inbox',
    firestore: { rules: PERMISSIVE_RULES, host: '127.0.0.1', port: 8081 },
  },
  'process-inbox-item',
)

if (available && env) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'municipalities', 'daet'), {
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1, lng: 122.95 },
      schemaVersion: 1,
    })
  })
}

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  if (!available || !env) return
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const collections = [
      'report_inbox',
      'reports',
      'report_private',
      'report_ops',
      'report_events',
      'report_lookup',
      'secret_lookup',
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

describe('processInboxItemCore', () => {
  itif(available)(
    'materializes a complete triptych + event + lookup from a valid inbox doc',
    async () => {
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
        expect(opsSnap.data()?.status).toBe('new')
        expect(opsSnap.data()?.municipalityId).toBe('daet')
        expect(opsSnap.data()?.reportType).toBe('flood')

        const lookupSnap = await getDoc(doc(ctx.firestore(), 'report_lookup', 'a1b2c3d4'))
        expect(lookupSnap.exists()).toBe(true)
        expect(lookupSnap.data()?.reportId).toBe(result.reportId)
        expect(lookupSnap.data()?.tokenHash).toBe('f'.repeat(64))
      })
    },
  )

  itif(available)('is idempotent — second invocation is a no-op', async () => {
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
          source: 'sms',
          publicLocation: { lat: 14.11, lng: 122.95 },
        },
      })

      const first = await processInboxItemCore({
        db,
        inboxId: 'ibx-2',
        now: () => 1713350401000,
      })
      expect(first.materialized).toBe(true)
      expect(first.replayed).toBe(false)

      const second = await processInboxItemCore({
        db,
        inboxId: 'ibx-2',
        now: () => 1713350402000,
      })
      expect(second.materialized).toBe(true)
      expect(second.replayed).toBe(true)
      expect(second.reportId).toBe(first.reportId)

      const reports = await getDocs(collection(ctx.firestore(), 'reports'))
      expect(reports.docs).toHaveLength(1)
    })
  })

  itif(available)(
    'writes 6-char locationGeohash onto report_ops when exactLocation present',
    async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-geohash'), {
          reporterUid: 'citizen-geo',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-geo',
          publicRef: 'geo00123',
          secretHash: 'a'.repeat(64),
          correlationId: '99999999-9999-4999-8999-999999999999',
          payload: {
            reportType: 'fire',
            description: 'structure fire',
            severity: 'high',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
            exactLocation: { lat: 14.11, lng: 122.95 },
          },
        })

        const result = await processInboxItemCore({
          db,
          inboxId: 'ibx-geohash',
          now: () => 1713350401000,
        })

        const opsSnap = await getDoc(doc(ctx.firestore(), 'report_ops', result.reportId))
        expect(opsSnap.exists()).toBe(true)
        const firstGeohash = opsSnap.data()?.locationGeohash
        expect(firstGeohash).toMatch(/^[a-z0-9]{6}$/)

        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-geohash-2'), {
          reporterUid: 'citizen-geo',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-geo-2',
          publicRef: 'geo00124',
          secretHash: 'c'.repeat(64),
          correlationId: '88888888-8888-4888-8888-888888888888',
          payload: {
            reportType: 'fire',
            description: 'structure fire',
            severity: 'high',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
            exactLocation: { lat: 14.12, lng: 122.96 },
          },
        })

        const secondResult = await processInboxItemCore({
          db,
          inboxId: 'ibx-geohash-2',
          now: () => 1713350402000,
        })
        const secondOpsSnap = await getDoc(
          doc(ctx.firestore(), 'report_ops', secondResult.reportId),
        )
        const secondGeohash = secondOpsSnap.data()?.locationGeohash
        expect(secondGeohash).toMatch(/^[a-z0-9]{6}$/)
        expect(secondGeohash).not.toBe(firstGeohash)
      })
    },
  )

  itif(available)(
    'omits locationGeohash from report_ops when exactLocation is absent',
    async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-noloc'), {
          reporterUid: 'citizen-noloc',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-noloc',
          publicRef: 'noloc123',
          secretHash: 'b'.repeat(64),
          correlationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          payload: {
            reportType: 'flood',
            description: 'sms flood report',
            severity: 'medium',
            source: 'sms',
            publicLocation: { lat: 14.11, lng: 122.95 },
          },
        })

        const result = await processInboxItemCore({
          db,
          inboxId: 'ibx-noloc',
          now: () => 1713350401000,
        })

        const opsSnap = await getDoc(doc(ctx.firestore(), 'report_ops', result.reportId))
        expect(opsSnap.exists()).toBe(true)
        expect(opsSnap.data()?.locationGeohash).toBeUndefined()
      })
    },
  )

  itif(available)('moves pending_media references into reports/{id}/media', async () => {
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

  itif(available)(
    'writes moderation_incident and throws when payload schema is invalid',
    async () => {
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
        expect(incidentSnap.data()?.reason).toBe('payload_schema_invalid')
      })
    },
  )

  itif(available)(
    'writes moderation_incident and throws when location is out of jurisdiction',
    async () => {
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
    },
  )

  itif(available)(
    'writes moderation_incident with reason location_missing when publicLocation is absent',
    async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-nopublic'), {
          reporterUid: 'citizen-1',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-nopublic',
          publicRef: 'nopub123',
          secretHash: 'f'.repeat(64),
          correlationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          payload: {
            reportType: 'flood',
            description: 'no location provided',
            severity: 'high',
            source: 'sms',
            // publicLocation intentionally absent
          },
        })

        await expect(
          processInboxItemCore({ db, inboxId: 'ibx-nopublic', now: () => 1713350401000 }),
        ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' })

        const incidentSnap = await getDoc(
          doc(ctx.firestore(), 'moderation_incidents', 'ibx-nopublic'),
        )
        expect(incidentSnap.exists()).toBe(true)
        expect(incidentSnap.data()?.reason).toBe('location_missing')
      })
    },
  )

  itif(available)(
    'materializes report without media when pendingMediaIds references a missing doc',
    async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        // Do NOT seed a pending_media doc for 'ghost-upload-id'
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-ghostmedia'), {
          reporterUid: 'citizen-ghost',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-ghostmedia',
          publicRef: 'ghost123',
          secretHash: 'f'.repeat(64),
          correlationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          payload: {
            reportType: 'fire',
            description: 'ghost media test',
            severity: 'medium',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
            pendingMediaIds: ['ghost-upload-id'],
          },
        })

        const result = await processInboxItemCore({
          db,
          inboxId: 'ibx-ghostmedia',
          now: () => 1713350401000,
        })
        expect(result.materialized).toBe(true)

        const mediaDocs = await getDocs(
          collection(ctx.firestore(), 'reports', result.reportId, 'media'),
        )
        expect(mediaDocs.size).toBe(0)
      })
    },
  )

  itif(available)('throws NOT_FOUND when inbox doc does not exist', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      await expect(
        processInboxItemCore({ db, inboxId: 'ibx-missing', now: () => 1713350401000 }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  itif(available)('throws CONFLICT when lookup doc exists with different secret hash', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      // Pre-write a conflicting lookup entry with the same public ref but a different token.
      await setDoc(doc(ctx.firestore(), 'report_lookup', 'conf1234'), {
        reportId: 'some-other-report',
        tokenHash: 'e'.repeat(64),
        expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        schemaVersion: 1,
      })
      await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-conflict'), {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-conflict',
        publicRef: 'conf1234',
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

  describe('secret_lookup on web submissions', () => {
    itif(available)('writes secret_lookup doc for web submissions', async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-web-secret'), {
          reporterUid: 'citizen-web',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-web-secret',
          publicRef: 'websec01',
          secretHash: 'abcd1234'.repeat(8), // 64-char hex
          correlationId: '11111111-1111-4111-8111-111111111111',
          payload: {
            reportType: 'flood',
            description: 'web submission for secret lookup test',
            severity: 'medium',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
          },
        })

        const result = await processInboxItemCore({
          db,
          inboxId: 'ibx-web-secret',
          now: () => 1713350401000,
        })

        expect(result.materialized).toBe(true)
        const secretSnap = await getDoc(doc(ctx.firestore(), 'secret_lookup', 'abcd1234'.repeat(8)))
        expect(secretSnap.exists()).toBe(true)
        expect(secretSnap.data()?.publicRef).toBe('websec01')
        expect(secretSnap.data()?.reportId).toBe(result.reportId)
        expect(secretSnap.data()?.expiresAt).toBe(1713350401000 + 90 * 24 * 60 * 60 * 1000)
      })
    })

    itif(available)('does NOT write secret_lookup for sms submissions', async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-sms-secret'), {
          reporterUid: 'citizen-sms',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-sms-secret',
          publicRef: 'smssec01',
          secretHash: '1234abcd'.repeat(8), // 64-char hex
          correlationId: '22222222-2222-4222-8222-222222222222',
          payload: {
            reportType: 'flood',
            description: 'sms submission for secret lookup test',
            severity: 'low',
            source: 'sms',
            publicLocation: { lat: 14.11, lng: 122.95 },
          },
        })

        const result = await processInboxItemCore({
          db,
          inboxId: 'ibx-sms-secret',
          now: () => 1713350401000,
        })

        expect(result.materialized).toBe(true)
        const secretSnap = await getDoc(doc(ctx.firestore(), 'secret_lookup', '1234abcd'.repeat(8)))
        expect(secretSnap.exists()).toBe(false)
      })
    })
  })
})
