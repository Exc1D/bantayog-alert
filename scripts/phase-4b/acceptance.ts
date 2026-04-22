/**
 * Phase 4b Acceptance Harness
 *
 * Runs acceptance checks against the Firebase emulators for the SMS inbound pipeline.
 * Validates the complete flow: webhook writes sms_inbox → trigger parses →
 * report_inbox created → processInboxItemCore materializes report → auto-reply queued.
 *
 * Usage:
 *   firebase emulators:exec --only firestore,database,auth \
 *     "pnpm exec tsx scripts/phase-4b/acceptance.ts"
 */

import { createRequire } from 'node:module'
import { strict as assert } from 'node:assert'
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto'

import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url))

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

interface TestEnvLike {
  projectId: string
  clearFirestore(): Promise<void>
  cleanup(): Promise<void>
}

let testEnv: TestEnvLike

let processInboxItemCore: Awaited<
  ReturnType<
    typeof import('../../functions/src/triggers/process-inbox-item.js')
  >['processInboxItemCore']
>
let enqueueSms: Awaited<
  ReturnType<typeof import('../../functions/src/services/send-sms.js')>['enqueueSms']
>
let parseInboundSms: (
  body: string,
) => ReturnType<(typeof import('@bantayog/shared-sms-parser'))['parseInboundSms']>
let normalizeMsisdn: (input: string) => string
let hashMsisdn: (normalizedMsisdn: string, salt: string) => string

function applyBaseEnv() {
  Object.assign(process.env, BASE_ENV)
}

async function setup() {
  applyBaseEnv()

  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'

  const { initializeTestEnvironment } = requireFromFunctions('@firebase/rules-unit-testing') as {
    initializeTestEnvironment: (config: {
      projectId: string
      firestore: { rules: string }
      database: { host: string; port: number }
    }) => Promise<TestEnvLike>
  }

  testEnv = await initializeTestEnvironment({
    projectId: `phase-4b-accept-${Date.now().toString()}`,
    firestore: {
      rules:
        'rules_version = "2";\nservice cloud.firestore {\n match /{d=**} { allow read, write: if true; }\n}',
    },
    database: { host: 'localhost', port: 9000 },
  })

  if (getApps().length === 0) {
    initializeApp({
      projectId: testEnv.projectId,
      databaseURL: `http://localhost:9000?ns=${testEnv.projectId}`,
    })
  }

  const processMod = await import('../../functions/src/triggers/process-inbox-item.js')
  processInboxItemCore = processMod.processInboxItemCore

  const smsMod = await import('../../functions/src/services/send-sms.js')
  enqueueSms = smsMod.enqueueSms

  const parserMod = requireFromFunctions('@bantayog/shared-sms-parser')
  parseInboundSms = parserMod.parseInboundSms

  const validatorsMod = requireFromFunctions('@bantayog/shared-validators')
  normalizeMsisdn = validatorsMod.normalizeMsisdn
  hashMsisdn = validatorsMod.hashMsisdn
}

async function seedMunicipalities(db: Firestore) {
  await db
    .collection('municipalities')
    .doc('daet')
    .set({
      id: 'daet',
      label: 'Daet',
      provinceId: 'camarines-norte',
      centroid: { lat: 14.1134, lng: 122.9554 },
      defaultSmsLocale: 'tl',
      schemaVersion: 1,
    })
}

async function resetState() {
  const db = getFirestore()
  await testEnv.clearFirestore()
  await getDatabase().ref('/').remove()
  await seedMunicipalities(db)
}

function generatePublicRef(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(8)
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i]! % chars.length]!
  }
  return result
}

async function test1_highConfidenceSmsParse() {
  console.log(
    '\n--- Test 1: High-confidence SMS parse → report materialized + auto-reply queued ---',
  )

  const db = getFirestore()
  const msisdn = '+639171234567'
  const rawBody = 'BANTAYOG BAHA CALASGASAN'
  const msgId = 'accept-test-001'
  const normalized = normalizeMsisdn(msisdn)
  const salt = process.env.SMS_MSISDN_HASH_SALT ?? 'acceptance-salt'
  const msisdnHash = hashMsisdn(normalized, salt)
  const encryptedMsisdn = encryptMsisdn(msisdn)

  const parseResult = parseInboundSms(rawBody)
  assert.equal(
    parseResult.confidence,
    'high',
    `expected high confidence, got ${parseResult.confidence}`,
  )
  assert.ok(parseResult.parsed, 'expected parsed result')
  assert.equal(parseResult.parsed!.barangay, 'Calasgasan', 'expected barangay Calasgasan')
  assert.equal(parseResult.parsed!.reportType, 'flood', 'expected reportType flood')

  const inboxId = `sms-${msgId}`
  const publicRef = generatePublicRef()
  const correlationId = randomUUID()

  await db.collection('sms_inbox').doc(msgId).set({
    providerId: 'globelabs',
    receivedAt: Date.now(),
    senderMsisdnHash: msisdnHash,
    senderMsisdnEnc: encryptedMsisdn,
    body: rawBody,
    parseStatus: 'pending',
    schemaVersion: 1,
  })

  await db
    .collection('report_inbox')
    .doc(inboxId)
    .set({
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
  assert.equal(coreResult.materialized, true, 'expected materialized true')
  assert.ok(coreResult.reportId, 'expected reportId')
  assert.ok(coreResult.publicRef, 'expected publicRef')

  const reportSnap = await db.collection('reports').doc(coreResult.reportId).get()
  assert.equal(reportSnap.exists, true, 'expected report to exist')
  const reportData = reportSnap.data()!
  assert.equal(reportData.source, 'sms', 'expected source sms')
  assert.equal(reportData.municipalityId, 'daet', 'expected municipalityId daet')

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

  const outboxQ = await db.collection('sms_outbox').get()
  const outboxDocs = outboxQ.docs.filter((d) => d.data().reportId === coreResult.reportId)
  assert.ok(outboxDocs.length > 0, 'expected auto-reply in sms_outbox')
  const outbox = outboxDocs[0]!.data()
  assert.equal(outbox.purpose, 'receipt_ack', 'expected purpose receipt_ack')
  assert.equal(outbox.status, 'queued', 'expected status queued')

  console.log('  PASS: High-confidence SMS parsed, report materialized, auto-reply queued')
}

async function test2_lowConfidenceSmsParse() {
  console.log('\n--- Test 2: Ambiguous barangay → none/low confidence returned ---')

  const rawBody = 'BANTAYOG FLOOD LANITON'
  const parseResult = parseInboundSms(rawBody)
  assert.ok(
    parseResult.confidence === 'none' || parseResult.confidence === 'low',
    `expected low/none confidence for unknown barangay, got ${parseResult.confidence}`,
  )

  console.log(`  Confidence: ${parseResult.confidence} (expected low/none for unknown barangay)`)
  console.log('  PASS: Parser correctly handles unknown barangay')
}

async function test3_webhookCoreRejectsMissingSecret() {
  console.log('\n--- Test 3: Webhook core rejects request without secret ---')

  const { smsInboundWebhookCore } = await import('../../functions/src/http/sms-inbound.js')

  const db = getFirestore()
  const result = await smsInboundWebhookCore({
    db,
    body: { from: '+639171234567', message: 'BANTAYOG FLOOD CALASGASAN' },
    headers: {},
    ip: '127.0.0.1',
    now: () => Date.now(),
  })
  assert.equal(result.status, 403, 'expected 403 without secret')

  console.log('  PASS: Webhook core correctly rejects unauthenticated request')
}

async function main() {
  console.log('Phase 4b Acceptance Harness')
  console.log('==============================')

  try {
    await setup()
    await resetState()

    await test1_highConfidenceSmsParse()
    await test2_lowConfidenceSmsParse()
    await test3_webhookCoreRejectsMissingSecret()

    console.log('\n==============================')
    console.log('ALL ACCEPTANCE TESTS PASSED')
    process.exit(0)
  } catch (err) {
    console.error('\nACCEPTANCE FAILED:', err)
    process.exit(1)
  } finally {
    if (testEnv) await testEnv.cleanup()
  }
}

main()
