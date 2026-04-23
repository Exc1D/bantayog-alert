import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { dispatchSmsOutboxCore } from '../../triggers/dispatch-sms-outbox.js';
import { resolveProvider } from '../../services/sms-providers/factory.js';
let testEnv;
const BASE_ENV = {
    SMS_PROVIDER_MODE: 'fake',
    FAKE_SMS_LATENCY_MS: '1',
    FAKE_SMS_ERROR_RATE: '0',
    FAKE_SMS_FAIL_PROVIDER: '',
    FAKE_SMS_IMPERSONATE: 'semaphore',
    SMS_MSISDN_HASH_SALT: 'test-salt',
};
const ORIGINAL = { ...process.env };
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: `phase-4a-disp-${Date.now().toString()}`,
        firestore: {
            rules: 'rules_version = "2";\nservice cloud.firestore {\n match /{d=**} { allow read, write: if true; }\n}',
        },
    });
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    if (getApps().length === 0)
        initializeApp({ projectId: testEnv.projectId });
});
beforeEach(() => {
    Object.assign(process.env, BASE_ENV);
});
afterEach(async () => {
    await testEnv.clearFirestore();
    Object.assign(process.env, ORIGINAL);
});
describe('dispatchSmsOutboxCore', () => {
    it('transitions queued → sent on successful send', async () => {
        const db = getFirestore();
        const outboxId = 'outbox-1';
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
            reportId: 'r1',
            createdAt: Date.now(),
            queuedAt: Date.now(),
            schemaVersion: 2,
        });
        await dispatchSmsOutboxCore({
            db,
            outboxId,
            previousStatus: undefined,
            currentStatus: 'queued',
            now: () => Date.now(),
            resolveProvider,
        });
        const after = (await db.collection('sms_outbox').doc(outboxId).get()).data();
        expect(after?.status).toBe('sent');
        expect(after?.sentAt).toBeGreaterThan(0);
        expect(after?.providerMessageId).toMatch(/^fake-/);
        expect(after?.encoding).toBe('GSM-7');
        expect(after?.segmentCount).toBe(1);
    });
    it('no-ops when previousStatus=sending (CAS already won by another invocation)', async () => {
        const db = getFirestore();
        await db
            .collection('sms_outbox')
            .doc('o')
            .set({
            providerId: 'semaphore',
            recipientMsisdnHash: 'a'.repeat(64),
            recipientMsisdn: '+639171234567',
            purpose: 'receipt_ack',
            predictedEncoding: 'GSM-7',
            predictedSegmentCount: 1,
            bodyPreviewHash: 'b'.repeat(64),
            status: 'sending',
            idempotencyKey: 'o',
            retryCount: 0,
            locale: 'tl',
            reportId: 'r1',
            createdAt: Date.now(),
            queuedAt: Date.now(),
            schemaVersion: 2,
        });
        await dispatchSmsOutboxCore({
            db,
            outboxId: 'o',
            previousStatus: 'queued',
            currentStatus: 'sending',
            now: () => Date.now(),
            resolveProvider,
        });
        const after = (await db.collection('sms_outbox').doc('o').get()).data();
        expect(after?.status).toBe('sending');
    });
    it('transitions queued → deferred on retryable error', async () => {
        process.env.FAKE_SMS_FAIL_PROVIDER = 'semaphore';
        const db = getFirestore();
        const id = 'outbox-retry';
        await db
            .collection('sms_outbox')
            .doc(id)
            .set({
            providerId: 'semaphore',
            recipientMsisdnHash: 'a'.repeat(64),
            recipientMsisdn: '+639171234567',
            purpose: 'receipt_ack',
            predictedEncoding: 'GSM-7',
            predictedSegmentCount: 1,
            bodyPreviewHash: 'b'.repeat(64),
            status: 'queued',
            idempotencyKey: id,
            retryCount: 0,
            locale: 'tl',
            reportId: 'r1',
            createdAt: Date.now(),
            queuedAt: Date.now(),
            schemaVersion: 2,
        });
        await dispatchSmsOutboxCore({
            db,
            outboxId: id,
            previousStatus: undefined,
            currentStatus: 'queued',
            now: () => Date.now(),
            resolveProvider,
        });
        const after = (await db.collection('sms_outbox').doc(id).get()).data();
        expect(after?.status).toBe('deferred');
        expect(after?.retryCount).toBe(1);
        expect(after?.deferralReason).toBe('provider_error');
    });
    it('transitions queued → abandoned when retryCount reaches 3', async () => {
        process.env.FAKE_SMS_FAIL_PROVIDER = 'semaphore';
        const db = getFirestore();
        const id = 'outbox-abandon';
        await db
            .collection('sms_outbox')
            .doc(id)
            .set({
            providerId: 'semaphore',
            recipientMsisdnHash: 'a'.repeat(64),
            recipientMsisdn: '+639171234567',
            purpose: 'receipt_ack',
            predictedEncoding: 'GSM-7',
            predictedSegmentCount: 1,
            bodyPreviewHash: 'b'.repeat(64),
            status: 'queued',
            idempotencyKey: id,
            retryCount: 3,
            locale: 'tl',
            reportId: 'r1',
            createdAt: Date.now(),
            queuedAt: Date.now(),
            schemaVersion: 2,
        });
        await dispatchSmsOutboxCore({
            db,
            outboxId: id,
            previousStatus: undefined,
            currentStatus: 'queued',
            now: () => Date.now(),
            resolveProvider,
        });
        const after = (await db.collection('sms_outbox').doc(id).get()).data();
        expect(after?.status).toBe('abandoned');
        expect(after?.terminalReason).toBe('abandoned_after_retries');
    });
});
//# sourceMappingURL=dispatch-sms-outbox.integration.test.js.map