/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import {} from '@firebase/rules-unit-testing';
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
const itif = (condition) => (condition ? it : it.skip);
// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn(() => ({})),
}));
import { verifyReportCore } from '../verify-report.js';
import { seedReportAtStatus, seedActiveAccount, staffClaims, } from '../../../__tests__/helpers/seed-factories.js';
import { Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules');
const ts = 1713350400000;
let testEnv;
let available = false;
beforeAll(async () => {
    const guarded = await guardInitTestEnvironment({
        projectId: 'verify-report-test',
        firestore: {
            host: 'localhost',
            port: 8081,
            rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
        },
    }, 'verify-report');
    testEnv = guarded.env;
    available = guarded.available;
    if (!available)
        return;
});
beforeEach(async () => {
    if (!available || !testEnv)
        return;
    await testEnv.clearFirestore();
});
afterAll(async () => {
    await testEnv?.cleanup();
});
describe('verifyReportCore', () => {
    itif(available)('advances new → awaiting_verify and writes report_event', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' });
            await seedActiveAccount(testEnv, {
                uid: 'admin-1',
                role: 'municipal_admin',
                municipalityId: 'daet',
            });
            const result = await verifyReportCore(db, {
                reportId,
                idempotencyKey: crypto.randomUUID(),
                actor: {
                    uid: 'admin-1',
                    claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
                },
                now: Timestamp.now(),
            });
            expect(result.status).toBe('awaiting_verify');
            expect(result.updatedAt).toBeDefined();
            const report = (await db.collection('reports').doc(reportId).get()).data();
            expect(report.status).toBe('awaiting_verify');
            expect(report.updatedAt).toBeDefined();
            expect(report.updatedAt).toBe(result.updatedAt);
            const events = await db.collection('report_events').where('reportId', '==', reportId).get();
            expect(events.docs).toHaveLength(1);
            expect(events.docs[0].data()).toMatchObject({
                from: 'new',
                to: 'awaiting_verify',
                actor: 'admin-1',
            });
        });
    });
    itif(available)('advances awaiting_verify → verified, stamps verifiedBy, and makes the report public', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'awaiting_verify', {
                municipalityId: 'daet',
            });
            await seedActiveAccount(testEnv, {
                uid: 'admin-1',
                role: 'municipal_admin',
                municipalityId: 'daet',
            });
            const result = await verifyReportCore(db, {
                reportId,
                idempotencyKey: crypto.randomUUID(),
                actor: {
                    uid: 'admin-1',
                    claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
                },
                now: Timestamp.now(),
            });
            expect(result.status).toBe('verified');
            expect(result.updatedAt).toBeDefined();
            const report = (await db.collection('reports').doc(reportId).get()).data();
            expect(report.status).toBe('verified');
            expect(report.verifiedBy).toBe('admin-1');
            expect(report.verifiedAt).toBeDefined();
            expect(report.visibilityClass).toBe('public_alertable');
            expect(report.updatedAt).toBeDefined();
            expect(report.updatedAt).toBe(result.updatedAt);
        });
    });
    itif(available)('is idempotent: same idempotencyKey returns cached result', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'daet' });
            await seedActiveAccount(testEnv, {
                uid: 'admin-1',
                role: 'municipal_admin',
                municipalityId: 'daet',
            });
            const key = crypto.randomUUID();
            const first = await verifyReportCore(db, {
                reportId,
                idempotencyKey: key,
                actor: {
                    uid: 'admin-1',
                    claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
                },
                now: Timestamp.now(),
            });
            const second = await verifyReportCore(db, {
                reportId,
                idempotencyKey: key,
                actor: {
                    uid: 'admin-1',
                    claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
                },
                now: Timestamp.now(),
            });
            expect(first.status).toBe('awaiting_verify');
            expect(second.status).toBe('awaiting_verify');
            const events = await db.collection('report_events').where('reportId', '==', reportId).get();
            expect(events.docs).toHaveLength(1); // no double event
        });
    });
});
describe('verifyReportCore error paths', () => {
    itif(available)('returns FORBIDDEN when admin is in a different municipality', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'mercedes' });
            await seedActiveAccount(testEnv, {
                uid: 'admin-1',
                role: 'municipal_admin',
                municipalityId: 'daet',
            });
            await expect(verifyReportCore(db, {
                reportId,
                idempotencyKey: crypto.randomUUID(),
                actor: {
                    uid: 'admin-1',
                    claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
                },
                now: Timestamp.now(),
            })).rejects.toMatchObject({ code: 'FORBIDDEN' });
        });
    });
    itif(available)('allows provincial_superadmin to verify report in any municipality', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'new', { municipalityId: 'mercedes' });
            await seedActiveAccount(testEnv, {
                uid: 'super-1',
                role: 'provincial_superadmin',
            });
            const result = await verifyReportCore(db, {
                reportId,
                idempotencyKey: crypto.randomUUID(),
                actor: {
                    uid: 'super-1',
                    claims: staffClaims({ role: 'provincial_superadmin' }),
                },
                now: Timestamp.now(),
            });
            expect(result.status).toBe('awaiting_verify');
            const report = (await db.collection('reports').doc(reportId).get()).data();
            expect(report.status).toBe('awaiting_verify');
        });
    });
    itif(available)('returns INVALID_STATUS_TRANSITION on a report already verified', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'verified', { municipalityId: 'daet' });
            await seedActiveAccount(testEnv, {
                uid: 'admin-1',
                role: 'municipal_admin',
                municipalityId: 'daet',
            });
            await expect(verifyReportCore(db, {
                reportId,
                idempotencyKey: crypto.randomUUID(),
                actor: {
                    uid: 'admin-1',
                    claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
                },
                now: Timestamp.now(),
            })).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
        });
    });
    itif(available)('returns INVALID_STATUS_TRANSITION when report is in terminal state', async () => {
        const municipalityId = 'daet';
        const reportId = `terminal-${crypto.randomUUID().slice(0, 8)}`;
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            await ctx
                .firestore()
                .collection('reports')
                .doc(reportId)
                .set({
                reportId,
                status: 'cancelled_false_report',
                municipalityId,
                approximateLocation: { municipality: municipalityId },
                createdAt: ts,
                lastStatusAt: ts,
                schemaVersion: 1,
            });
        });
        await seedActiveAccount(testEnv, { uid: 'admin-1', role: 'municipal_admin', municipalityId });
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await expect(verifyReportCore(db, {
                reportId,
                actor: {
                    uid: 'admin-1',
                    claims: staffClaims({ role: 'municipal_admin', municipalityId }),
                },
                now: Timestamp.now(),
                idempotencyKey: crypto.randomUUID(),
            })).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
        });
    });
    itif(available)('returns NOT_FOUND on missing report', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            await seedActiveAccount(testEnv, {
                uid: 'admin-1',
                role: 'municipal_admin',
                municipalityId: 'daet',
            });
            await expect(verifyReportCore(db, {
                reportId: 'does-not-exist',
                idempotencyKey: crypto.randomUUID(),
                actor: {
                    uid: 'admin-1',
                    claims: staffClaims({ role: 'municipal_admin', municipalityId: 'daet' }),
                },
                now: Timestamp.now(),
            })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });
    });
});
//# sourceMappingURL=verify-report.test.js.map