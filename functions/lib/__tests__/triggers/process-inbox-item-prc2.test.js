import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { processInboxItemCore } from '../../triggers/process-inbox-item.js';
const PERMISSIVE_RULES = 'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}';
let env;
const TEST_SALT = 'test-sms-salt-prc2';
beforeAll(async () => {
    process.env.SMS_MSISDN_HASH_SALT = TEST_SALT;
    env = await initializeTestEnvironment({
        projectId: 'demo-prc2-inbox',
        firestore: { rules: PERMISSIVE_RULES },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'municipalities', 'daet'), {
            id: 'daet',
            label: 'Daet',
            provinceId: 'camarines-norte',
            centroid: { lat: 14.1, lng: 122.95 },
            defaultSmsLocale: 'tl',
            schemaVersion: 1,
        });
    });
});
afterAll(async () => {
    if (env)
        await env.cleanup();
});
beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        const collections = [
            'report_inbox',
            'reports',
            'report_private',
            'report_ops',
            'report_events',
            'report_lookup',
            'report_sms_consent',
            'moderation_incidents',
            'idempotency_keys',
            'pending_media',
            'sms_outbox',
        ];
        for (const col of collections) {
            const docs = await db.collection(col).get();
            for (const d of docs.docs) {
                await d.ref.delete();
            }
        }
    });
});
describe('processInboxItem — PRE-C.2 sms_consent fields', () => {
    it('writes municipalityId onto report_sms_consent when materializing', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = ctx.firestore();
            await setDoc(doc(ctx.firestore(), 'report_inbox', 'inbox-1'), {
                reporterUid: 'citizen-1',
                clientCreatedAt: 1713350400000,
                idempotencyKey: 'ik-inbox-1',
                publicRef: 'abcd1234',
                secretHash: 'a'.repeat(64),
                correlationId: '11111111-1111-4111-8111-111111111111',
                payload: {
                    reportType: 'flood',
                    description: 'flooding here',
                    severity: 'medium',
                    source: 'web',
                    publicLocation: { lat: 14.11, lng: 122.95 },
                    contact: { phone: '+639171234567', smsConsent: true },
                },
            });
            await processInboxItemCore({ db, inboxId: 'inbox-1', now: () => 1713350401000 });
            const consentSnaps = await getDocs(collection(ctx.firestore(), 'report_sms_consent'));
            expect(consentSnaps.size).toBe(1);
            expect(consentSnaps.docs[0].data().municipalityId).toBe('daet');
        });
    });
    it('writes followUpConsent true when reporter gave consent', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = ctx.firestore();
            await setDoc(doc(ctx.firestore(), 'report_inbox', 'inbox-2'), {
                reporterUid: 'citizen-1',
                clientCreatedAt: 1713350400000,
                idempotencyKey: 'ik-inbox-2',
                publicRef: 'abcd1235',
                secretHash: 'a'.repeat(64),
                correlationId: '22222222-2222-4222-8222-222222222222',
                payload: {
                    reportType: 'flood',
                    description: 'flooding here',
                    severity: 'medium',
                    source: 'web',
                    publicLocation: { lat: 14.11, lng: 122.95 },
                    contact: { phone: '+639171234567', smsConsent: true },
                    followUpConsent: true,
                },
            });
            await processInboxItemCore({ db, inboxId: 'inbox-2', now: () => 1713350401000 });
            const consentSnaps = await getDocs(collection(ctx.firestore(), 'report_sms_consent'));
            expect(consentSnaps.size).toBe(1);
            expect(consentSnaps.docs[0].data().followUpConsent).toBe(true);
        });
    });
    it('writes followUpConsent false when reporter gave no consent', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = ctx.firestore();
            await setDoc(doc(ctx.firestore(), 'report_inbox', 'inbox-3'), {
                reporterUid: 'citizen-1',
                clientCreatedAt: 1713350400000,
                idempotencyKey: 'ik-inbox-3',
                publicRef: 'abcd1236',
                secretHash: 'a'.repeat(64),
                correlationId: '33333333-3333-4333-8333-333333333333',
                payload: {
                    reportType: 'flood',
                    description: 'flooding here',
                    severity: 'medium',
                    source: 'web',
                    publicLocation: { lat: 14.11, lng: 122.95 },
                    contact: { phone: '+639171234567', smsConsent: true },
                    followUpConsent: false,
                },
            });
            await processInboxItemCore({ db, inboxId: 'inbox-3', now: () => 1713350401000 });
            const consentSnaps = await getDocs(collection(ctx.firestore(), 'report_sms_consent'));
            expect(consentSnaps.size).toBe(1);
            expect(consentSnaps.docs[0].data().followUpConsent).toBe(false);
        });
    });
    it('defaults followUpConsent to false when omitted from payload', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const db = ctx.firestore();
            await setDoc(doc(ctx.firestore(), 'report_inbox', 'inbox-4'), {
                reporterUid: 'citizen-1',
                clientCreatedAt: 1713350400000,
                idempotencyKey: 'ik-inbox-4',
                publicRef: 'abcd1237',
                secretHash: 'a'.repeat(64),
                correlationId: '44444444-4444-4444-8444-444444444444',
                payload: {
                    reportType: 'flood',
                    description: 'flooding here',
                    severity: 'medium',
                    source: 'web',
                    publicLocation: { lat: 14.11, lng: 122.95 },
                    contact: { phone: '+639171234567', smsConsent: true },
                },
            });
            await processInboxItemCore({ db, inboxId: 'inbox-4', now: () => 1713350401000 });
            const consentSnaps = await getDocs(collection(ctx.firestore(), 'report_sms_consent'));
            expect(consentSnaps.size).toBe(1);
            expect(consentSnaps.docs[0].data().followUpConsent).toBe(false);
        });
    });
});
//# sourceMappingURL=process-inbox-item-prc2.test.js.map