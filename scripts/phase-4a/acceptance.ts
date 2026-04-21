/**
 * Phase 4a Acceptance Gate
 *
 * Runs 13 acceptance checks against the Firebase emulators.
 * No production code changes are required; this script validates the
 * current callable/trigger cores with a clean per-test harness.
 *
 * Usage:
 *   firebase emulators:exec --only firestore,database,auth \
 *     "pnpm exec tsx scripts/phase-4a/acceptance.ts"
 */

import { createRequire } from 'node:module'
import { strict as assert } from 'node:assert'

import { getApps, initializeApp } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'

interface TestEnvLike {
  projectId: string
  clearFirestore(): Promise<void>
  cleanup(): Promise<void>
}

const requireFromFunctions = createRequire(new URL('../../functions/package.json', import.meta.url))

const BASE_ENV = {
  SMS_PROVIDER_MODE: 'fake',
  FAKE_SMS_LATENCY_MS: '10',
  FAKE_SMS_ERROR_RATE: '0',
  FAKE_SMS_FAIL_PROVIDER: '',
  FAKE_SMS_IMPERSONATE: 'semaphore',
  SMS_MSISDN_HASH_SALT: 'acceptance-salt',
  SMS_WEBHOOK_INBOUND_SECRET: 'acceptance-webhook-secret',
  FIREBASE_APP_CHECK_TOKEN: 'test-token',
}

let testEnv: TestEnvLike

let verifyReportCore: typeof import('../../functions/src/callables/verify-report.js').verifyReportCore
let processInboxItemCore: typeof import('../../functions/src/triggers/process-inbox-item.js').processInboxItemCore
let dispatchResponderCore: typeof import('../../functions/src/callables/dispatch-responder.js').dispatchResponderCore
let closeReportCore: typeof import('../../functions/src/callables/close-report.js').closeReportCore
let dispatchSmsOutboxCore: typeof import('../../functions/src/triggers/dispatch-sms-outbox.js').dispatchSmsOutboxCore
let reconcileSmsDeliveryStatusCore: typeof import('../../functions/src/triggers/reconcile-sms-delivery-status.js').reconcileSmsDeliveryStatusCore
let smsDeliveryReportCore: typeof import('../../functions/src/http/sms-delivery-report.js').smsDeliveryReportCore
let resolveProvider: typeof import('../../functions/src/services/sms-providers/factory.js').resolveProvider
let seedReportAtStatus: typeof import('../../functions/src/__tests__/helpers/seed-factories.js').seedReportAtStatus
let seedResponderDoc: typeof import('../../functions/src/__tests__/helpers/seed-factories.js').seedResponderDoc
let seedResponderShift: typeof import('../../functions/src/__tests__/helpers/seed-factories.js').seedResponderShift
let staffClaims: typeof import('../../functions/src/__tests__/helpers/seed-factories.js').staffClaims

function applyBaseEnv() {
  Object.assign(process.env, BASE_ENV)
}

async function setup() {
  applyBaseEnv()

  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
  process.env.DATABASE_EMULATOR_HOST = 'localhost:9000'

  const {
    initializeTestEnvironment,
  }: {
    initializeTestEnvironment: (config: {
      projectId: string
      firestore: { rules: string }
    }) => Promise<TestEnvLike>
  } = requireFromFunctions('@firebase/rules-unit-testing')

  testEnv = await initializeTestEnvironment({
    projectId: `phase-4a-accept-${Date.now().toString()}`,
    firestore: {
      rules:
        'rules_version = "2";\nservice cloud.firestore {\n match /{d=**} { allow read, write: if true; }\n}',
    },
  })

  if (getApps().length === 0) {
    initializeApp({
      projectId: testEnv.projectId,
      databaseURL: `http://localhost:9000?ns=${testEnv.projectId}`,
    })
  }

  ;({ verifyReportCore } = await import('../../functions/src/callables/verify-report.js'))
  ;({ processInboxItemCore } = await import('../../functions/src/triggers/process-inbox-item.js'))
  ;({ dispatchResponderCore } = await import('../../functions/src/callables/dispatch-responder.js'))
  ;({ closeReportCore } = await import('../../functions/src/callables/close-report.js'))
  ;({ dispatchSmsOutboxCore } = await import('../../functions/src/triggers/dispatch-sms-outbox.js'))
  ;({ reconcileSmsDeliveryStatusCore } =
    await import('../../functions/src/triggers/reconcile-sms-delivery-status.js'))
  ;({ smsDeliveryReportCore } = await import('../../functions/src/http/sms-delivery-report.js'))
  ;({ resolveProvider } = await import('../../functions/src/services/sms-providers/factory.js'))
  ;({ seedReportAtStatus, seedResponderDoc, seedResponderShift, staffClaims } =
    await import('../../functions/src/__tests__/helpers/seed-factories.js'))
}

async function clearSmsProviderHealthState(db: Firestore) {
  for (const providerId of ['semaphore', 'globelabs'] as const) {
    const healthRef = db.collection('sms_provider_health').doc(providerId)
    const windowsSnap = await healthRef.collection('minute_windows').get()
    let batch = db.batch()
    for (let i = 0; i < windowsSnap.size; i++) {
      batch.delete(windowsSnap.docs[i]!.ref)
      if ((i + 1) % 400 === 0) {
        await batch.commit()
        batch = db.batch()
      }
    }
    await batch.commit()
    await healthRef.delete()
  }
}

async function seedMunicipalities(db: Firestore) {
  await db
    .collection('municipalities')
    .doc('daet')
    .set({
      id: 'daet',
      label: 'Daet',
      centroid: { lat: 14.1134, lng: 122.9554 },
      defaultSmsLocale: 'tl',
      schemaVersion: 1,
    })

  await db
    .collection('municipalities')
    .doc('m1')
    .set({
      id: 'm1',
      label: 'Test Municipality',
      centroid: { lat: 14.1134, lng: 122.9554 },
      defaultSmsLocale: 'tl',
      schemaVersion: 1,
    })
}

async function resetState() {
  const db = getFirestore()

  await clearSmsProviderHealthState(db)
  await testEnv.clearFirestore()
  await getDatabase().ref('/').remove()
  await seedMunicipalities(db)
}

function actor(uid: string, municipalityId: string) {
  return {
    uid,
    claims: staffClaims({ role: 'municipal_admin', municipalityId }),
  }
}

async function readOnlyOutboxDoc(db: Firestore) {
  const outboxQ = await db.collection('sms_outbox').get()
  assert.equal(outboxQ.size, 1, `expected 1 outbox doc, got ${outboxQ.size}`)
  return outboxQ.docs[0]!.data()
}

async function test1_processInboxItemEnqueuesReceiptAck() {
  const db = getFirestore()
  const inboxId = 'ibx-t1-receipt'

  await db
    .collection('report_inbox')
    .doc(inboxId)
    .set({
      reporterUid: 'citizen-uid',
      clientCreatedAt: Date.now(),
      idempotencyKey: 'ik-t1',
      publicRef: 'aaaaaaaa',
      secretHash: 'a'.repeat(64),
      correlationId: crypto.randomUUID(),
      payload: {
        reportType: 'flood',
        description: 'Test flood report',
        severity: 'medium',
        source: 'web',
        publicLocation: { lat: 14.1134, lng: 122.9554 },
        contact: { phone: '+639171234567', smsConsent: true },
      },
    })

  await processInboxItemCore({
    db,
    inboxId,
    now: () => Date.now(),
  })

  const outbox = await readOnlyOutboxDoc(db)
  assert.equal(outbox.purpose, 'receipt_ack')
  assert.equal(outbox.recipientMsisdn, '+639171234567')
  assert.equal(outbox.status, 'queued')
}

async function test2_dispatchSmsOutboxSendsSuccessfully() {
  const db = getFirestore()
  const outboxId = 'outbox-t2'

  await db
    .collection('sms_outbox')
    .doc(outboxId)
    .set({
      providerId: 'semaphore',
      recipientMsisdnHash: 'a'.repeat(64),
      recipientMsisdn: '+639171234567',
      purpose: 'receipt_ack',
      predictedEncoding: 'GSM-7',
      predictedSegmentCount: 1,
      bodyPreviewHash: 'b'.repeat(64),
      status: 'queued',
      idempotencyKey: outboxId,
      retryCount: 0,
      locale: 'tl',
      reportId: 'r-t2',
      createdAt: Date.now(),
      queuedAt: Date.now(),
      schemaVersion: 2,
    })

  await dispatchSmsOutboxCore({
    db,
    outboxId,
    previousStatus: undefined,
    currentStatus: 'queued',
    now: () => Date.now(),
    resolveProvider,
  })

  const after = (await db.collection('sms_outbox').doc(outboxId).get()).data()
  assert.equal(after?.status, 'sent')
  assert.ok((after?.sentAt ?? 0) > 0)
  assert.ok(
    typeof after?.providerMessageId === 'string' && after.providerMessageId.startsWith('fake-'),
  )
}

async function test3_verifyReportEnqueuesVerification() {
  const db = getFirestore()
  const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
    municipalityId: 'daet',
    reporterContact: { phone: '+639171234567', smsConsent: true, locale: 'tl' },
  })

  await verifyReportCore(db, {
    reportId,
    idempotencyKey: 'idemp-t3',
    actor: actor('admin-t3', 'daet'),
    now: Timestamp.now(),
  })

  const outbox = await readOnlyOutboxDoc(db)
  assert.equal(outbox.purpose, 'verification')
  assert.equal(outbox.recipientMsisdn, '+639171234567')
  assert.equal(outbox.status, 'queued')
}

async function test4_noConsentSkipsVerificationSms() {
  const db = getFirestore()
  const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
    municipalityId: 'daet',
  })

  await verifyReportCore(db, {
    reportId,
    idempotencyKey: 'idemp-t4',
    actor: actor('admin-t4', 'daet'),
    now: Timestamp.now(),
  })

  const outboxQ = await db.collection('sms_outbox').get()
  assert.equal(outboxQ.size, 0, `expected 0 outbox docs, got ${outboxQ.size}`)
}

async function test5_dispatchResponderEnqueuesStatusUpdate() {
  const db = getFirestore()
  const rtdb = getDatabase()
  const { reportId } = await seedReportAtStatus(db, 'verified', {
    municipalityId: 'daet',
    reporterContact: { phone: '+639171234567', smsConsent: true, locale: 'tl' },
  })
  await seedResponderDoc(db, {
    uid: 'resp-t5',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
    isActive: true,
  })
  await seedResponderShift(rtdb, 'daet', 'resp-t5', true)

  const result = await dispatchResponderCore(db, rtdb, {
    reportId,
    responderUid: 'resp-t5',
    actor: actor('admin-t5', 'daet'),
    idempotencyKey: 'idemp-t5',
    now: Timestamp.now(),
  })

  const outbox = await readOnlyOutboxDoc(db)
  assert.equal(outbox.purpose, 'status_update')
  assert.equal(outbox.recipientMsisdn, '+639171234567')
  const dispatchSnap = await db.collection('dispatches').doc(result.dispatchId).get()
  assert.equal(dispatchSnap.exists, true, `expected dispatch ${result.dispatchId} to exist`)
}

async function test6_closeReportEnqueuesResolution() {
  const db = getFirestore()
  const { reportId } = await seedReportAtStatus(db, 'resolved', {
    municipalityId: 'daet',
    reporterContact: { phone: '+639171234567', smsConsent: true, locale: 'tl' },
  })

  await closeReportCore(db, {
    reportId,
    actor: actor('admin-t6', 'daet'),
    idempotencyKey: 'idemp-t6',
    now: Timestamp.now(),
  })

  const outbox = await readOnlyOutboxDoc(db)
  assert.equal(outbox.purpose, 'resolution')
  assert.equal(outbox.recipientMsisdn, '+639171234567')
}

async function test7_circuitFailoverRouting() {
  const db = getFirestore()
  const outboxId = 'outbox-t7'

  await db.collection('sms_provider_health').doc('semaphore').set({
    providerId: 'semaphore',
    circuitState: 'open',
    updatedAt: Date.now(),
  })
  await db.collection('sms_provider_health').doc('globelabs').set({
    providerId: 'globelabs',
    circuitState: 'closed',
    updatedAt: Date.now(),
  })

  process.env.FAKE_SMS_FAIL_PROVIDER = 'semaphore'
  process.env.FAKE_SMS_IMPERSONATE = 'semaphore'

  await db
    .collection('sms_outbox')
    .doc(outboxId)
    .set({
      providerId: 'semaphore',
      recipientMsisdnHash: 'a'.repeat(64),
      recipientMsisdn: '+639171234567',
      purpose: 'status_update',
      predictedEncoding: 'GSM-7',
      predictedSegmentCount: 1,
      bodyPreviewHash: 'b'.repeat(64),
      status: 'queued',
      idempotencyKey: outboxId,
      retryCount: 0,
      locale: 'tl',
      reportId: 'r-t7',
      createdAt: Date.now(),
      queuedAt: Date.now(),
      schemaVersion: 2,
    })

  await dispatchSmsOutboxCore({
    db,
    outboxId,
    previousStatus: undefined,
    currentStatus: 'queued',
    now: () => Date.now(),
    resolveProvider,
  })

  const after = (await db.collection('sms_outbox').doc(outboxId).get()).data()
  assert.equal(
    after?.status,
    'sent',
    `expected sent via globelabs failover, got ${after?.status ?? 'missing'}`,
  )
  assert.equal(after?.providerId, 'globelabs')
}

async function test8_dlrDeliveredClearsPlaintext() {
  const db = getFirestore()
  const outboxId = 'outbox-t8'
  const secret = process.env.SMS_WEBHOOK_INBOUND_SECRET ?? ''

  await db
    .collection('sms_outbox')
    .doc(outboxId)
    .set({
      providerId: 'semaphore',
      recipientMsisdnHash: 'a'.repeat(64),
      recipientMsisdn: '+639171234567',
      purpose: 'status_update',
      predictedEncoding: 'GSM-7',
      predictedSegmentCount: 1,
      bodyPreviewHash: 'b'.repeat(64),
      status: 'sent',
      idempotencyKey: outboxId,
      retryCount: 0,
      locale: 'tl',
      reportId: 'r-t8',
      createdAt: Date.now(),
      queuedAt: Date.now(),
      sentAt: Date.now(),
      providerMessageId: 'msg-t8',
      schemaVersion: 2,
    })

  const result = await smsDeliveryReportCore({
    db,
    headers: { 'x-sms-provider-secret': secret },
    body: { providerMessageId: 'msg-t8', status: 'delivered' },
    now: () => Date.now(),
    expectedSecret: secret,
  })

  assert.equal(result.status, 200)

  const after = (await db.collection('sms_outbox').doc(outboxId).get()).data()
  assert.equal(after?.status, 'delivered')
  assert.ok((after?.deliveredAt ?? 0) > 0)
  assert.equal(after?.recipientMsisdn, null)
}

async function test9_idempotencyDuplicateEnqueueOnlyOneDoc() {
  const db = getFirestore()
  const { reportId } = await seedReportAtStatus(db, 'resolved', {
    municipalityId: 'daet',
    reporterContact: { phone: '+639171234567', smsConsent: true, locale: 'tl' },
  })

  const idempKey = 'shared-idemp-t9'

  await closeReportCore(db, {
    reportId,
    actor: actor('admin-t9', 'daet'),
    idempotencyKey: idempKey,
    now: Timestamp.now(),
  })
  await closeReportCore(db, {
    reportId,
    actor: actor('admin-t9', 'daet'),
    idempotencyKey: idempKey,
    now: Timestamp.now(),
  })

  const outboxQ = await db.collection('sms_outbox').get()
  assert.equal(outboxQ.size, 1, `expected 1 outbox doc (idempotent), got ${outboxQ.size}`)
}

async function test10_orphanSweepMarksAbandoned() {
  const db = getFirestore()
  const oldTime = Date.now() - 31 * 60 * 1000

  await db
    .collection('sms_outbox')
    .doc('outbox-t10')
    .set({
      providerId: 'semaphore',
      recipientMsisdnHash: 'a'.repeat(64),
      recipientMsisdn: '+639171234567',
      purpose: 'status_update',
      predictedEncoding: 'GSM-7',
      predictedSegmentCount: 1,
      bodyPreviewHash: 'b'.repeat(64),
      status: 'queued',
      idempotencyKey: 'outbox-t10',
      retryCount: 0,
      locale: 'tl',
      reportId: 'r-t10',
      createdAt: oldTime,
      queuedAt: oldTime,
      schemaVersion: 2,
    })

  await reconcileSmsDeliveryStatusCore({ db, now: () => Date.now() })

  const after = (await db.collection('sms_outbox').doc('outbox-t10').get()).data()
  assert.equal(after?.status, 'abandoned')
}

async function test11_callbackAfterTerminal200NoOp() {
  const db = getFirestore()
  const outboxId = 'outbox-t11'
  const secret = process.env.SMS_WEBHOOK_INBOUND_SECRET ?? ''

  await db
    .collection('sms_outbox')
    .doc(outboxId)
    .set({
      providerId: 'semaphore',
      recipientMsisdnHash: 'a'.repeat(64),
      recipientMsisdn: '+639171234567',
      purpose: 'receipt_ack',
      predictedEncoding: 'GSM-7',
      predictedSegmentCount: 1,
      bodyPreviewHash: 'b'.repeat(64),
      status: 'delivered',
      idempotencyKey: outboxId,
      retryCount: 0,
      locale: 'tl',
      reportId: 'r-t11',
      createdAt: Date.now(),
      queuedAt: Date.now(),
      sentAt: Date.now(),
      providerMessageId: 'msg-t11',
      deliveredAt: Date.now(),
      schemaVersion: 2,
    })

  const result = await smsDeliveryReportCore({
    db,
    headers: { 'x-sms-provider-secret': secret },
    body: { providerMessageId: 'msg-t11', status: 'delivered' },
    now: () => Date.now(),
    expectedSecret: secret,
  })

  assert.equal(result.status, 200)

  const after = (await db.collection('sms_outbox').doc(outboxId).get()).data()
  assert.equal(
    after?.status,
    'delivered',
    `expected unchanged delivered, got ${after?.status ?? 'missing'}`,
  )
}

async function test12_retryScenarioDeferredThenQueuedThenSent() {
  const db = getFirestore()
  const outboxId = 'outbox-t12'

  process.env.FAKE_SMS_FAIL_PROVIDER = 'semaphore'

  await db
    .collection('sms_outbox')
    .doc(outboxId)
    .set({
      providerId: 'semaphore',
      recipientMsisdnHash: 'a'.repeat(64),
      recipientMsisdn: '+639171234567',
      purpose: 'receipt_ack',
      predictedEncoding: 'GSM-7',
      predictedSegmentCount: 1,
      bodyPreviewHash: 'b'.repeat(64),
      status: 'queued',
      idempotencyKey: outboxId,
      retryCount: 0,
      locale: 'tl',
      reportId: 'r-t12',
      createdAt: Date.now(),
      queuedAt: Date.now(),
      schemaVersion: 2,
    })

  await dispatchSmsOutboxCore({
    db,
    outboxId,
    previousStatus: undefined,
    currentStatus: 'queued',
    now: () => Date.now(),
    resolveProvider,
  })

  const deferred = (await db.collection('sms_outbox').doc(outboxId).get()).data()
  assert.equal(
    deferred?.status,
    'deferred',
    `expected deferred after first failure, got ${deferred?.status ?? 'missing'}`,
  )

  process.env.FAKE_SMS_FAIL_PROVIDER = ''
  await db.collection('sms_outbox').doc(outboxId).set(
    {
      status: 'queued',
      queuedAt: Date.now(),
    },
    { merge: true },
  )

  await dispatchSmsOutboxCore({
    db,
    outboxId,
    previousStatus: 'deferred',
    currentStatus: 'queued',
    now: () => Date.now(),
    resolveProvider,
  })

  const after = (await db.collection('sms_outbox').doc(outboxId).get()).data()
  assert.equal(after?.status, 'sent', `expected sent on retry, got ${after?.status ?? 'missing'}`)
}

async function test13_noConsentPathSkipsEnqueue() {
  const db = getFirestore()
  const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
    municipalityId: 'daet',
  })

  await verifyReportCore(db, {
    reportId,
    idempotencyKey: 'idemp-t13',
    actor: actor('admin-t13', 'daet'),
    now: Timestamp.now(),
  })

  const outboxQ = await db.collection('sms_outbox').get()
  assert.equal(outboxQ.size, 0, `expected 0 outbox docs (no consent), got ${outboxQ.size}`)
}

function formatError(err: unknown): string {
  return err instanceof Error ? (err.stack ?? err.message) : String(err)
}

async function main() {
  await setup()

  const tests = [
    test1_processInboxItemEnqueuesReceiptAck,
    test2_dispatchSmsOutboxSendsSuccessfully,
    test3_verifyReportEnqueuesVerification,
    test4_noConsentSkipsVerificationSms,
    test5_dispatchResponderEnqueuesStatusUpdate,
    test6_closeReportEnqueuesResolution,
    test7_circuitFailoverRouting,
    test8_dlrDeliveredClearsPlaintext,
    test9_idempotencyDuplicateEnqueueOnlyOneDoc,
    test10_orphanSweepMarksAbandoned,
    test11_callbackAfterTerminal200NoOp,
    test12_retryScenarioDeferredThenQueuedThenSent,
    test13_noConsentPathSkipsEnqueue,
  ]

  let passed = 0
  let failed = 0

  try {
    for (const testFn of tests) {
      applyBaseEnv()
      await resetState()

      try {
        await testFn()
        console.log(`✅ ${testFn.name}`)
        passed++
      } catch (err) {
        console.error(`❌ ${testFn.name}: ${formatError(err)}`)
        failed++
      }
    }
  } finally {
    await testEnv.cleanup()
  }

  console.log(`\nPhase 4a acceptance: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(formatError(err))
  process.exit(1)
})
