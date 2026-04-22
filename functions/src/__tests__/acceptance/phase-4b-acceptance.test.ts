/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
/**
 * Phase 4b Acceptance Harness
 *
 * Runs against the Firebase emulator suite via:
 *   firebase emulators:exec --only firestore,database,auth \
 *     "cd functions && pnpm exec vitest run src/__tests__/acceptance/phase-4b-acceptance.test.ts --reporter=verbose"
 */

import { createCipheriv, randomBytes, randomUUID } from 'node:crypto'
import { describe, it, beforeAll, afterAll, afterEach, expect } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { initializeApp, getApps } from 'firebase-admin/app'
import { doc, setDoc, collection, getDocs } from 'firebase/firestore'

const PERMISSIVE_RULES =
  'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}'

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

const BASE_ENV = {
  SMS_PROVIDER_MODE: 'fake',
  FAKE_SMS_LATENCY_MS: '10',
  FAKE_SMS_ERROR_RATE: '0',
  FAKE_SMS_FAIL_PROVIDER: '',
  FAKE_SMS_IMPERSONATE: 'semaphore',
  SMS_MSISDN_HASH_SALT: 'acceptance-salt',
  SMS_MSISDN_ENCRYPTION_KEY: ENCRYPTION_KEY,
  GLOBE_LABS_WEBHOOK_SECRET: 'acceptance-webhook-secret',
  FIREBASE_APP_CHECK_TOKEN: 'test-token',
}

function applyBaseEnv() {
  Object.assign(process.env, BASE_ENV)
}

let testEnv: RulesTestEnvironment

let processInboxItemCore: typeof import('../../triggers/process-inbox-item.js').processInboxItemCore
let enqueueSms: typeof import('../../services/send-sms.js').enqueueSms
let parseInboundSms: typeof import('@bantayog/shared-sms-parser').parseInboundSms
let normalizeMsisdn: typeof import('@bantayog/shared-validators').normalizeMsisdn
let hashMsisdn: typeof import('@bantayog/shared-validators').hashMsisdn

beforeAll(async () => {
  applyBaseEnv()
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  process.env.DATABASE_EMULATOR_HOST = 'localhost:9000'

  testEnv = await initializeTestEnvironment({
    projectId: `phase-4b-accept-${Date.now().toString()}`,
    firestore: { rules: PERMISSIVE_RULES },
    database: { host: 'localhost', port: 9000 },
  })

  if (getApps().length === 0) {
    initializeApp({
      projectId: testEnv.projectId,
      databaseURL: `http://localhost:9000?ns=${testEnv.projectId}`,
    })
  }

  const processMod = await import('../../triggers/process-inbox-item.js')
  processInboxItemCore = processMod.processInboxItemCore

  const smsMod = await import('../../services/send-sms.js')
  enqueueSms = smsMod.enqueueSms

  const parserMod = await import('@bantayog/shared-sms-parser')
  parseInboundSms = parserMod.parseInboundSms

  const validatorsMod = await import('@bantayog/shared-validators')
  normalizeMsisdn = validatorsMod.normalizeMsisdn
  hashMsisdn = validatorsMod.hashMsisdn

  const db = testEnv.unauthenticatedContext().firestore() as any
  await setDoc(doc(db, 'municipalities', 'daet'), {
    id: 'daet',
    label: 'Daet',
    provinceId: 'camarines-norte',
    centroid: { lat: 14.1134, lng: 122.9554 },
    defaultSmsLocale: 'tl',
    schemaVersion: 1,
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

afterEach(async () => {
  await testEnv.clearFirestore()
})

function generatePublicRef(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(8)
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i]! % chars.length]!
  }
  return result
}

describe('Phase 4b Acceptance', () => {
  it('test1: high-confidence SMS parse → report materialized + auto-reply queued', async () => {
    const db = testEnv.unauthenticatedContext().firestore() as any
    const msisdn = '+639171234567'
    const rawBody = 'BANTAYOG BAHA CALASGASAN'
    const msgId = 'accept-test-001'
    const normalized = normalizeMsisdn(msisdn)
    const salt = process.env.SMS_MSISDN_HASH_SALT ?? 'acceptance-salt'
    const msisdnHash = hashMsisdn(normalized, salt)
    const encryptedMsisdn = encryptMsisdn(msisdn)

    const parseResult = parseInboundSms(rawBody)
    expect(parseResult.confidence).toBe('high')
    expect(parseResult.parsed).toBeTruthy()
    expect(parseResult.parsed!.barangay).toBe('Calasgasan')
    expect(parseResult.parsed!.reportType).toBe('flood')

    const inboxId = `sms-${msgId}`
    const publicRef = generatePublicRef()
    const correlationId = randomUUID()

    await setDoc(doc(db, 'sms_inbox', msgId), {
      providerId: 'globelabs',
      receivedAt: Date.now(),
      senderMsisdnHash: msisdnHash,
      senderMsisdnEnc: encryptedMsisdn,
      body: rawBody,
      parseStatus: 'pending',
      schemaVersion: 1,
    })

    await setDoc(doc(db, 'report_inbox', inboxId), {
      reporterUid: `sms:${msgId}`,
      clientCreatedAt: Date.now(),
      idempotencyKey: inboxId,
      publicRef,
      secretHash: randomBytes(32).toString('hex'),
      correlationId,
      payload: {
        reportType: parseResult.parsed!.reportType,
        description:
          parseResult.parsed!.details ??
          `SMS: ${parseResult.parsed!.reportType} at ${parseResult.parsed!.barangay}`,
        severity: 'medium' as const,
        source: 'sms' as const,
        publicLocation: { lat: 14.1134, lng: 122.9554 },
      },
    })

    const coreResult = await processInboxItemCore({ db, inboxId })
    expect(coreResult.materialized).toBe(true)
    expect(coreResult.reportId).toBeTruthy()
    expect(coreResult.publicRef).toBeTruthy()

    const reportSnap = await getDocs(collection(db, 'reports'))
    expect(reportSnap.size).toBeGreaterThan(0)
    const reportData = reportSnap.docs.find((d) => d.id === coreResult.reportId)?.data()
    expect(reportData?.source).toBe('sms')
    expect(reportData?.municipalityId).toBe('daet')

    // eslint-disable-next-line @typescript-eslint/require-await
    await db.runTransaction(async (tx) => {
      enqueueSms(db, tx, {
        reportId: coreResult.reportId,
        purpose: 'receipt_ack',
        recipientMsisdn: msisdn,
        locale: 'tl',
        publicRef: coreResult.publicRef,
        salt,
        nowMs: Date.now(),
        providerId: 'globelabs',
      })
    })

    const outboxQ = await getDocs(collection(db, 'sms_outbox'))
    const outboxDocs = outboxQ.docs.filter((d) => d.data().reportId === coreResult.reportId)
    expect(outboxDocs.length).toBeGreaterThan(0)
    const outbox = outboxDocs[0]!.data()
    expect(outbox.purpose).toBe('receipt_ack')
    expect(outbox.status).toBe('queued')
  })

  it('test2: low-confidence for barangay not in gazetteer', () => {
    const rawBody = 'BANTAYOG FLOOD LANITON'
    const parseResult = parseInboundSms(rawBody)
    expect(parseResult.confidence === 'none' || parseResult.confidence === 'low').toBe(true)
  })

  it('test3: webhook core rejects request without secret', async () => {
    const { smsInboundWebhookCore } = await import('../../http/sms-inbound.js')
    const db = testEnv.unauthenticatedContext().firestore() as any
    const result = await smsInboundWebhookCore({
      db,
      body: { from: '+639171234567', message: 'BANTAYOG FLOOD CALASGASAN' },
      headers: {},
      ip: '127.0.0.1',
      now: () => Date.now(),
    })
    expect(result.status).toBe(403)
  })
})
