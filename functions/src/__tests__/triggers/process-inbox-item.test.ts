import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { processInboxItemCore } from '../../triggers/process-inbox-item.js'

const PERMISSIVE_RULES =
  'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}'

let env: RulesTestEnvironment | undefined
const TEST_SALT = 'test-sms-salt-ph4a'
beforeAll(async () => {
  process.env.SMS_MSISDN_HASH_SALT = TEST_SALT
  env = await initializeTestEnvironment({
    projectId: 'demo-phase-3a-inbox',
    firestore: { rules: PERMISSIVE_RULES },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'municipalities', 'daet'), {
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1, lng: 122.95 },
      defaultSmsLocale: 'tl',
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
      'sms_outbox',
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
      expect(opsSnap.data()?.reportType).toBe('flood')

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

      const second = await processInboxItemCore({
        db,
        inboxId: 'ibx-2',
        now: () => 1713350402000,
      })
      expect(second.materialized).toBe(true)
      expect(second.replayed).toBe(true)
      expect(second.reportId).toBe(first.reportId)
    })
  })

  it('writes 6-char locationGeohash onto report_ops when exactLocation present', async () => {
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
      const secondOpsSnap = await getDoc(doc(ctx.firestore(), 'report_ops', secondResult.reportId))
      const secondGeohash = secondOpsSnap.data()?.locationGeohash
      expect(secondGeohash).toMatch(/^[a-z0-9]{6}$/)
      expect(secondGeohash).not.toBe(firstGeohash)
    })
  })

  it('omits locationGeohash from report_ops when exactLocation is absent', async () => {
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
      expect(incidentSnap.data()?.reason).toBe('payload_schema_invalid')
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

  it('writes moderation_incident with reason location_missing when publicLocation is absent', async () => {
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
  })

  it('skips SMS enqueue without throwing when SMS_MSISDN_HASH_SALT is unset', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = ctx.firestore() as any
      const savedSalt = process.env.SMS_MSISDN_HASH_SALT
      try {
        delete process.env.SMS_MSISDN_HASH_SALT
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-nosalt'), {
          reporterUid: 'citizen-salt',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-nosalt',
          publicRef: 'nosalt01',
          secretHash: 'f'.repeat(64),
          correlationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          payload: {
            reportType: 'flood',
            description: 'salt missing test',
            severity: 'low',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
            contact: { phone: '+639171234567', smsConsent: true },
          },
        })

        const result = await processInboxItemCore({
          db,
          inboxId: 'ibx-nosalt',
          now: () => 1713350401000,
        })
        expect(result.materialized).toBe(true)

        const outboxQ = await getDocs(collection(ctx.firestore(), 'sms_outbox'))
        expect(outboxQ.size).toBe(0)
      } finally {
        process.env.SMS_MSISDN_HASH_SALT = savedSalt
      }
    })
  })

  it('materializes report without media when pendingMediaIds references a missing doc', async () => {
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
      await setDoc(doc(ctx.firestore(), 'report_lookup', 'conf1234'), {
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

  describe('SMS enqueue on consent', () => {
    it('writes sms_outbox receipt_ack when contact.smsConsent=true', async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-sms-consent'), {
          reporterUid: 'citizen-sms',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-sms-consent',
          publicRef: 'smsref01',
          secretHash: 'f'.repeat(64),
          correlationId: '66666666-6666-4666-8666-666666666666',
          payload: {
            reportType: 'flood',
            description: 'flooded area',
            severity: 'medium',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
            contact: { phone: '+639171234567', smsConsent: true },
          },
        })

        const result = await processInboxItemCore({
          db,
          inboxId: 'ibx-sms-consent',
          now: () => 1713350401000,
        })

        expect(result.materialized).toBe(true)
        const outboxQ = await getDocs(collection(ctx.firestore(), 'sms_outbox'))
        expect(outboxQ.size).toBe(1)
        const outbox = outboxQ.docs[0]!.data()
        expect(outbox.status).toBe('queued')
        expect(outbox.recipientMsisdn).toBe('+639171234567')
        expect(outbox.purpose).toBe('receipt_ack')
        expect(outbox.reportId).toBe(result.reportId)
      })
    })

    it('does NOT write sms_outbox when contact is absent', async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-no-contact'), {
          reporterUid: 'citizen-nocontact',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-no-contact',
          publicRef: 'noctct01',
          secretHash: 'f'.repeat(64),
          correlationId: '77777777-7777-4777-8777-777777777777',
          payload: {
            reportType: 'flood',
            description: 'no contact info',
            severity: 'low',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
          },
        })

        const result = await processInboxItemCore({
          db,
          inboxId: 'ibx-no-contact',
          now: () => 1713350401000,
        })

        expect(result.materialized).toBe(true)
        const outboxQ = await getDocs(collection(ctx.firestore(), 'sms_outbox'))
        expect(outboxQ.size).toBe(0)
      })
    })

    it('is idempotent — sms_outbox is not duplicated on replay', async () => {
      await env!.withSecurityRulesDisabled(async (ctx) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = ctx.firestore() as any
        await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-sms-replay'), {
          reporterUid: 'citizen-replay',
          clientCreatedAt: 1713350400000,
          idempotencyKey: 'idem-sms-replay',
          publicRef: 'smsrpy01',
          secretHash: 'f'.repeat(64),
          correlationId: '88888888-8888-4888-8888-888888888888',
          payload: {
            reportType: 'flood',
            description: 'replay test',
            severity: 'low',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
            contact: { phone: '+639178765432', smsConsent: true },
          },
        })

        const first = await processInboxItemCore({
          db,
          inboxId: 'ibx-sms-replay',
          now: () => 1713350401000,
        })
        expect(first.materialized).toBe(true)

        const second = await processInboxItemCore({
          db,
          inboxId: 'ibx-sms-replay',
          now: () => 1713350402000,
        })
        expect(second.replayed).toBe(true)

        const outboxQ = await getDocs(collection(ctx.firestore(), 'sms_outbox'))
        expect(outboxQ.size).toBe(1)
      })
    })
  })
})
