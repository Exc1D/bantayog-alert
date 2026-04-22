/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { parseInboundSms } from '@bantayog/shared-sms-parser'
import { processInboxItemCore } from '../triggers/process-inbox-item.js'
import { smsInboundWebhookCore } from '../http/sms-inbound.js'
import { hashMsisdn, normalizeMsisdn } from '@bantayog/shared-validators'

const PERMISSIVE_RULES =
  'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}'

const TEST_SALT = 'acceptance-sms-salt'
const ENCRYPTION_KEY = Buffer.from(randomBytes(32)).toString('hex')

function encryptMsisdn(msisdn: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(msisdn, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.from(
    JSON.stringify({
      iv: iv.toString('hex'),
      ct: encrypted.toString('hex'),
      tag: authTag.toString('hex'),
    }),
  ).toString('base64')
}

let env: RulesTestEnvironment | undefined
const TEST_PROJECT_ID = `phase-4b-sms-inbound-test-${Date.now().toString()}`

beforeAll(async () => {
  process.env.SMS_MSISDN_HASH_SALT = TEST_SALT
  process.env.SMS_MSISDN_ENCRYPTION_KEY = ENCRYPTION_KEY
  process.env.GLOBE_LABS_WEBHOOK_SECRET = 'test-secret'
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  env = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: { rules: PERMISSIVE_RULES },
  })
  const db = env.unauthenticatedContext().firestore() as any
  await setDoc(doc(db, 'municipalities', 'daet'), {
    id: 'daet',
    label: 'Daet',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.1, lng: 122.95 },
    defaultSmsLocale: 'tl',
    schemaVersion: 1,
  })
  await setDoc(doc(db, 'municipalities', 'jose-panganiban'), {
    id: 'jose-panganiban',
    label: 'Jose Panganiban',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.3, lng: 122.7 },
    defaultSmsLocale: 'tl',
    schemaVersion: 1,
  })
  await setDoc(doc(db, 'municipalities', 'labo'), {
    id: 'labo',
    label: 'Labo',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.2, lng: 122.8 },
    defaultSmsLocale: 'tl',
    schemaVersion: 1,
  })
})

afterAll(async () => {
  if (env) await env.cleanup()
})

beforeEach(async () => {
  await env!.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as any
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
      'sms_inbox',
      'sms_outbox',
      'sms_sessions',
    ]
    for (const col of collections) {
      const docs = await getDocs(collection(db, col))
      for (const d of docs.docs) {
        await deleteDoc(d.ref)
      }
    }
  })
})

describe('parseInboundSms', () => {
  it('parses high-confidence flood report', () => {
    const result = parseInboundSms('BANTAYOG FLOOD CALASGASAN')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('flood')
    expect(result.parsed?.barangay).toBe('Calasgasan')
    expect(result.parsed?.details).toBeUndefined()
  })

  it('parses with type synonym BAHA', () => {
    const result = parseInboundSms('BANTAYOG BAHA LABO')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.reportType).toBe('flood')
  })

  it('fuzzy-matches barangay with typo', () => {
    const result = parseInboundSms('BANTAYOG FIRE CALASGAN')
    expect(result.confidence).toBe('low')
    expect(result.parsed?.barangay).toBe('Calasgasan')
    expect(result.parsed?.rawBarangay).toBe('CALASGAN')
  })

  it('returns none for barangay not in gazetteer', () => {
    const result = parseInboundSms('BANTAYOG FLOOD LANIT')
    expect(result.confidence).toBe('none')
    expect(result.parsed).toBeNull()
  })

  it('returns none for unknown type', () => {
    const result = parseInboundSms('BANTAYOG EARTHQUAKE CALASGASAN')
    expect(result.confidence).toBe('none')
    expect(result.parsed).toBeNull()
  })

  it('returns none for missing barangay', () => {
    const result = parseInboundSms('BANTAYOG FIRE')
    expect(result.confidence).toBe('none')
  })

  it('extracts details after barangay', () => {
    const result = parseInboundSms('BANTAYOG FIRE CALASGASAN water rising fast')
    expect(result.confidence).toBe('high')
    expect(result.parsed?.barangay).toBe('Calasgasan')
    expect(result.parsed?.details).toContain('water')
  })
})

describe('smsInboundWebhookCore', () => {
  it('writes to sms_inbox with hashed msisdn and encrypted MSISDN', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const msisdn = '+639171234567'
      const rawBody = 'BANTAYOG FLOOD CALASGASAN'
      const msgId = 'webhook-test-001'

      const result = await smsInboundWebhookCore({
        db,
        body: { from: msisdn, message: rawBody, id: msgId },
        headers: { 'x-globe-labs-secret': 'test-secret' },
        ip: '47.58.100.1',
        now: () => Date.now(),
      })

      expect(result.status).toBe(200)
      expect(result.body?.ok).toBe(true)

      const q = await getDocs(collection(db, 'sms_inbox'))
      const written = q.docs.find((d) => d.id === msgId)
      expect(written?.data().senderMsisdnHash).toBe(hashMsisdn(normalizeMsisdn(msisdn), TEST_SALT))
      expect(written?.data().senderMsisdnEnc).toBeDefined()
      expect(written?.data().body).toBe(rawBody)
      expect(written?.data().parseStatus).toBe('pending')
      expect(written?.data().providerId).toBe('globelabs')
    })
  })

  it('rejects request without secret', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const result = await smsInboundWebhookCore({
        db,
        body: { from: '+639171234567', message: 'BANTAYOG FLOOD CALASGASAN' },
        headers: {},
        ip: '47.58.100.1',
        now: () => Date.now(),
      })
      expect(result.status).toBe(403)
    })
  })

  it('rejects non-POST method', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const result = await smsInboundWebhookCore({
        db,
        body: null,
        headers: {},
        ip: '47.58.100.1',
        now: () => Date.now(),
        method: 'GET',
      })
      expect(result.status).toBe(405)
    })
  })
})

describe('SMS inbound processor simulation', () => {
  it('materializes report from high-confidence SMS parse', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const msisdn = '+639171234567'
      const rawBody = 'BANTAYOG BAHA CALASGASAN'
      const msgId = 'processor-test-001'
      const normalized = normalizeMsisdn(msisdn)
      const msisdnHash = hashMsisdn(normalized, TEST_SALT)
      const encryptedMsisdn = encryptMsisdn(msisdn)

      await setDoc(doc(db, 'sms_inbox', msgId), {
        providerId: 'globelabs',
        receivedAt: Date.now(),
        senderMsisdnHash: msisdnHash,
        senderMsisdnEnc: encryptedMsisdn,
        body: rawBody,
        parseStatus: 'pending',
        schemaVersion: 1,
      })

      const parseResult = parseInboundSms(rawBody)
      expect(parseResult.confidence).toBe('high')
      expect(parseResult.parsed).not.toBeNull()

      const inboxId = `sms-${msgId}`
      const publicRef = 'smsref01'
      await setDoc(doc(db, 'report_inbox', inboxId), {
        reporterUid: `sms:${msgId}`,
        clientCreatedAt: Date.now(),
        idempotencyKey: inboxId,
        publicRef,
        secretHash: randomBytes(32).toString('hex'),
        correlationId: randomUUID(),
        payload: {
          reportType: parseResult.parsed!.reportType,
          description:
            parseResult.parsed!.details ??
            `SMS: ${parseResult.parsed!.reportType} at ${parseResult.parsed!.barangay}`,
          severity: 'medium' as const,
          source: 'sms' as const,
          publicLocation: { lat: 14.1, lng: 122.95 },
        },
      })

      const coreResult = await processInboxItemCore({ db, inboxId })
      expect(coreResult.materialized).toBe(true)
      expect(coreResult.reportId).toBeDefined()
      expect(coreResult.publicRef).toBeDefined()
    })
  })

  it('returns none for barangay not in gazetteer', () => {
    const rawBody = 'BANTAYOG FLOOD LANIT'
    const parseResult = parseInboundSms(rawBody)
    expect(parseResult.confidence).toBe('none')
    expect(parseResult.parsed).toBeNull()
  })

  it('writes report_inbox with sms-specific fields', async () => {
    await env!.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as any
      const msisdn = '+639171234567'
      const rawBody = 'BANTAYOG FIRE BAGASBAS'
      const msgId = 'processor-fields-001'
      const normalized = normalizeMsisdn(msisdn)
      const msisdnHash = hashMsisdn(normalized, TEST_SALT)
      const encryptedMsisdn = encryptMsisdn(msisdn)

      await setDoc(doc(db, 'sms_inbox', msgId), {
        providerId: 'globelabs',
        receivedAt: Date.now(),
        senderMsisdnHash: msisdnHash,
        senderMsisdnEnc: encryptedMsisdn,
        body: rawBody,
        parseStatus: 'pending',
        schemaVersion: 1,
      })

      const parseResult = parseInboundSms(rawBody)
      const inboxId = `sms-${msgId}`
      await setDoc(doc(db, 'report_inbox', inboxId), {
        reporterUid: `sms:${msgId}`,
        clientCreatedAt: Date.now(),
        idempotencyKey: inboxId,
        publicRef: 'smsref02',
        secretHash: randomBytes(32).toString('hex'),
        correlationId: randomUUID(),
        payload: {
          reportType: parseResult.parsed!.reportType,
          description:
            parseResult.parsed!.details ??
            `SMS: ${parseResult.parsed!.reportType} at ${parseResult.parsed!.barangay}`,
          severity: 'medium' as const,
          source: 'sms' as const,
          publicLocation: { lat: 14.1, lng: 122.95 },
        },
      })

      const coreResult = await processInboxItemCore({ db, inboxId })
      expect(coreResult.materialized).toBe(true)
      expect(coreResult.reportId).toBeDefined()
      expect(coreResult.publicRef).toBeDefined()
    })
  })
})
