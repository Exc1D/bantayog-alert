import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { smsDeliveryReportCore } from '../../http/sms-delivery-report.js';
let testEnv;
const SECRET = 'test-webhook-secret';
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: `phase-4a-dlr-${Date.now().toString()}`,
        firestore: {
            rules: 'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}',
        },
    });
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.SMS_WEBHOOK_INBOUND_SECRET = SECRET;
    if (getApps().length === 0)
        initializeApp({ projectId: testEnv.projectId });
});
afterEach(async () => {
    await testEnv.clearFirestore();
});
describe('smsDeliveryReportCore', () => {
    it('valid secret + valid payload for sent row → delivered + plaintext cleared', async () => {
        const db = getFirestore();
        await db
            .collection('sms_outbox')
            .doc('o1')
            .set({
            providerId: 'semaphore',
            recipientMsisdnHash: 'a'.repeat(64),
            recipientMsisdn: '+639171234567',
            purpose: 'receipt_ack',
            predictedEncoding: 'GSM-7',
            predictedSegmentCount: 1,
            bodyPreviewHash: 'b'.repeat(64),
            status: 'sent',
            providerMessageId: 'pm-1',
            idempotencyKey: 'o1',
            retryCount: 0,
            locale: 'tl',
            reportId: 'r1',
            createdAt: Date.now(),
            queuedAt: Date.now(),
            sentAt: Date.now(),
            schemaVersion: 2,
        });
        const res = await smsDeliveryReportCore({
            db,
            headers: { 'x-sms-provider-secret': SECRET },
            body: { providerMessageId: 'pm-1', status: 'delivered' },
            now: () => Date.now(),
            expectedSecret: SECRET,
        });
        expect(res.status).toBe(200);
        const after = (await db.collection('sms_outbox').doc('o1').get()).data();
        expect(after?.status).toBe('delivered');
        expect(after?.recipientMsisdn).toBeNull();
        expect(after?.deliveredAt).toBeGreaterThan(0);
    });
    it('invalid secret → 401', async () => {
        const res = await smsDeliveryReportCore({
            db: getFirestore(),
            headers: { 'x-sms-provider-secret': 'wrong' },
            body: { providerMessageId: 'pm-1', status: 'delivered' },
            now: () => Date.now(),
            expectedSecret: SECRET,
        });
        expect(res.status).toBe(401);
    });
    it('unknown providerMessageId → 200 no-op', async () => {
        const res = await smsDeliveryReportCore({
            db: getFirestore(),
            headers: { 'x-sms-provider-secret': SECRET },
            body: { providerMessageId: 'pm-unknown', status: 'delivered' },
            now: () => Date.now(),
            expectedSecret: SECRET,
        });
        expect(res.status).toBe(200);
    });
    it('abandoned row → 200 no-op with callback_after_terminal log (no mutation)', async () => {
        const db = getFirestore();
        await db
            .collection('sms_outbox')
            .doc('ab')
            .set({
            providerId: 'semaphore',
            recipientMsisdnHash: 'a'.repeat(64),
            recipientMsisdn: null,
            purpose: 'receipt_ack',
            predictedEncoding: 'GSM-7',
            predictedSegmentCount: 1,
            bodyPreviewHash: 'b'.repeat(64),
            status: 'abandoned',
            providerMessageId: 'pm-ab',
            abandonedAt: Date.now(),
            terminalReason: 'abandoned_after_retries',
            idempotencyKey: 'ab',
            retryCount: 3,
            locale: 'tl',
            reportId: 'r1',
            createdAt: Date.now(),
            queuedAt: Date.now(),
            schemaVersion: 2,
        });
        const res = await smsDeliveryReportCore({
            db,
            headers: { 'x-sms-provider-secret': SECRET },
            body: { providerMessageId: 'pm-ab', status: 'delivered' },
            now: () => Date.now(),
            expectedSecret: SECRET,
        });
        expect(res.status).toBe(200);
        const after = (await db.collection('sms_outbox').doc('ab').get()).data();
        expect(after?.status).toBe('abandoned');
    });
});
//# sourceMappingURL=sms-delivery-report.integration.test.js.map