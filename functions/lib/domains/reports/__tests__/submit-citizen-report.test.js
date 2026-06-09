import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
const itif = (condition) => (condition ? it : it.skip);
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { processInboxItemCore } from '../process-inbox-item.js';
import { submitCitizenReportCore } from '../submit-citizen-report.js';
const PERMISSIVE_RULES = 'rules_version="2";\nservice cloud.firestore { match /{d=**} { allow read,write:if true; }}';
const { env, available } = await guardInitTestEnvironment({
    projectId: 'submit-citizen-report-test',
    firestore: { rules: PERMISSIVE_RULES, host: '127.0.0.1', port: 8081 },
}, 'submit-citizen-report');
afterAll(async () => {
    await env?.cleanup();
});
beforeEach(async () => {
    if (!available || !env)
        return;
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        const collections = [
            'report_inbox',
            'reports',
            'report_private',
            'report_ops',
            'report_events',
            'report_lookup',
            'secret_lookup',
            'idempotency_keys',
        ];
        for (const col of collections) {
            const docs = await db.collection(col).get();
            for (const d of docs.docs) {
                await d.ref.delete();
            }
        }
        await db
            .collection('municipalities')
            .doc('daet')
            .set({
            id: 'daet',
            label: 'Daet',
            provinceId: 'camarines-norte',
            centroid: { lat: 14.1, lng: 122.95 },
            schemaVersion: 1,
        });
    });
});
function baseInput(overrides = {}) {
    return {
        reporterUid: 'citizen-1',
        clientCreatedAt: 1713350400000,
        idempotencyKey: 'idem-1',
        publicRef: 'call1234',
        secretHash: 'a'.repeat(64),
        correlationId: '11111111-1111-4111-8111-111111111111',
        payload: {
            reportType: 'flood',
            description: 'flooded street',
            severity: 'high',
            source: 'web',
            publicLocation: { lat: 14.11, lng: 122.95 },
            municipalityId: 'daet',
            triage: {
                peopleInjured: true,
                peopleTrapped: false,
                locationConfidence: 'approximate',
                urgencyReason: 'Water is entering homes.',
            },
        },
        now: () => 1713350401000,
        ...overrides,
    };
}
describe('submitCitizenReportCore', () => {
    itif(available)('materializes a citizen report triptych directly from callable input', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const result = await submitCitizenReportCore(db, baseInput());
            expect(result.materialized).toBe(true);
            expect(result.replayed).toBe(false);
            expect(result.publicRef).toBe('call1234');
            const reportSnap = await getDoc(doc(ctx.firestore(), 'reports', result.reportId));
            expect(reportSnap.exists()).toBe(true);
            expect(reportSnap.data()?.status).toBe('new');
            expect(reportSnap.data()?.publicLocation).toEqual({ lat: 14.11, lng: 122.95 });
            const privateSnap = await getDoc(doc(ctx.firestore(), 'report_private', result.reportId));
            expect(privateSnap.data()?.reporterUid).toBe('citizen-1');
            const opsSnap = await getDoc(doc(ctx.firestore(), 'report_ops', result.reportId));
            expect(opsSnap.data()?.reportId).toBe(result.reportId);
            expect(opsSnap.data()?.status).toBe('new');
            expect(opsSnap.data()?.reportType).toBe('flood');
            expect(opsSnap.data()?.triage).toEqual({
                peopleInjured: true,
                peopleTrapped: false,
                locationConfidence: 'approximate',
                urgencyReason: 'Water is entering homes.',
            });
            const lookupSnap = await getDoc(doc(ctx.firestore(), 'report_lookup', 'call1234'));
            expect(lookupSnap.data()?.reportId).toBe(result.reportId);
            expect(lookupSnap.data()?.tokenHash).toBe('a'.repeat(64));
        });
    });
    itif(available)('replays an existing publicRef when the secret hash matches', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const first = await submitCitizenReportCore(db, baseInput());
            const second = await submitCitizenReportCore(db, baseInput({ idempotencyKey: 'idem-retry' }));
            expect(second.replayed).toBe(true);
            expect(second.reportId).toBe(first.reportId);
            const reports = await getDocs(collection(ctx.firestore(), 'reports'));
            expect(reports.docs).toHaveLength(1);
        });
    });
    itif(available)('rejects an existing publicRef when the secret hash differs', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await submitCitizenReportCore(db, baseInput());
            await expect(submitCitizenReportCore(db, baseInput({ idempotencyKey: 'idem-conflict', secretHash: 'b'.repeat(64) }))).rejects.toThrow(/publicRef already exists/i);
        });
    });
    itif(available)('lets report_inbox fallback replay a callable-created report', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const first = await submitCitizenReportCore(db, baseInput());
            await setDoc(doc(ctx.firestore(), 'report_inbox', 'ibx-replay'), {
                reporterUid: 'citizen-1',
                clientCreatedAt: 1713350400000,
                idempotencyKey: 'idem-inbox-replay',
                publicRef: 'call1234',
                secretHash: 'a'.repeat(64),
                correlationId: '11111111-1111-4111-8111-111111111111',
                payload: baseInput().payload,
            });
            const replay = await processInboxItemCore({
                db,
                inboxId: 'ibx-replay',
                now: () => 1713350402000,
            });
            expect(replay.replayed).toBe(true);
            expect(replay.reportId).toBe(first.reportId);
            const reports = await getDocs(collection(ctx.firestore(), 'reports'));
            expect(reports.docs).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=submit-citizen-report.test.js.map