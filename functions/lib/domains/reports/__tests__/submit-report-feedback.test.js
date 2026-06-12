/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {} from '@firebase/rules-unit-testing';
import { Timestamp } from 'firebase-admin/firestore';
import { guardInitTestEnvironment } from '../../../__tests__/helpers/emulator-guard.js';
vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn(() => ({})),
}));
vi.mock('firebase-admin/storage', () => ({
    getStorage: vi.fn(() => ({
        bucket: vi.fn(() => ({
            getFiles: vi.fn(() => Promise.resolve([[], []])),
        })),
    })),
}));
import { submitReportFeedbackCore } from '../submit-report-feedback.js';
import { seedReportAtStatus } from '../../../__tests__/helpers/seed-factories.js';
const itif = (condition) => (condition ? it : it.skip);
const guarded = await guardInitTestEnvironment({
    projectId: 'submit-report-feedback-test',
    firestore: { host: 'localhost', port: 8081 },
}, 'submit-report-feedback');
const testEnv = guarded.env;
const available = guarded.available;
beforeEach(async () => {
    if (!available || !testEnv)
        return;
    await testEnv.clearFirestore();
});
afterAll(async () => {
    await testEnv?.cleanup();
});
describe('submitReportFeedbackCore', () => {
    itif(available)('writes feedback for the reporter on a resolved report', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const now = Timestamp.fromMillis(1713350400000);
            const { reportId } = await seedReportAtStatus(db, 'resolved', {
                reporterUid: 'citizen-1',
            });
            const result = await submitReportFeedbackCore(db, {
                reportId,
                addressed: true,
                comment: '  Help arrived quickly.  ',
                actor: { uid: 'citizen-1', claims: { role: 'citizen' } },
                now,
            });
            expect(result).toMatchObject({
                reportId,
                addressed: true,
                submittedAt: now.toMillis(),
            });
            const feedbackSnap = await db.collection('report_feedback').doc(reportId).get();
            expect(feedbackSnap.exists).toBe(true);
            expect(feedbackSnap.data()).toMatchObject({
                reportId,
                reporterUid: 'citizen-1',
                addressed: true,
                comment: 'Help arrived quickly.',
                submittedAt: now.toMillis(),
                updatedAt: now.toMillis(),
                schemaVersion: 1,
            });
        });
    });
    itif(available)('rejects a non-reporter with NOT_FOUND (enumeration protection)', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'resolved', {
                reporterUid: 'citizen-1',
            });
            await expect(submitReportFeedbackCore(db, {
                reportId,
                addressed: true,
                actor: { uid: 'citizen-2', claims: { role: 'citizen' } },
                now: Timestamp.fromMillis(1713350400000),
            })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });
    });
    itif(available)('rejects missing report_private with NOT_FOUND (enumeration protection)', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const now = Timestamp.fromMillis(1713350400000);
            const reportRef = db.collection('reports').doc('missing-private-report');
            await reportRef.set({
                status: 'resolved',
                municipalityId: 'muni-1',
                barangayId: 'brgy-1',
                reporterRole: 'citizen',
                reportType: 'flood',
                severity: 'low',
                publicLocation: { lat: 14.5, lng: 121.0 },
                mediaRefs: [],
                description: 'test',
                submittedAt: now.toMillis(),
                visibilityClass: 'internal',
                visibility: { scope: 'municipality', sharedWith: [] },
                source: 'web',
                hasPhotoAndGPS: false,
                schemaVersion: 1,
                municipalityLabel: 'Manila',
                correlationId: '00000000-0000-0000-0000-000000000000',
            });
            await expect(submitReportFeedbackCore(db, {
                reportId: 'missing-private-report',
                addressed: true,
                actor: { uid: 'citizen-1', claims: { role: 'citizen' } },
                now,
            })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });
    });
    itif(available)('rejects a non-resolved report with FAILED_PRECONDITION', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'verified', {
                reporterUid: 'citizen-1',
            });
            await expect(submitReportFeedbackCore(db, {
                reportId,
                addressed: false,
                actor: { uid: 'citizen-1', claims: { role: 'citizen' } },
                now: Timestamp.fromMillis(1713350400000),
            })).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
        });
    });
    itif(available)('overwrites the same feedback doc when the reporter corrects it', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'resolved', {
                reporterUid: 'citizen-1',
            });
            await submitReportFeedbackCore(db, {
                reportId,
                addressed: false,
                comment: 'Still waiting',
                actor: { uid: 'citizen-1', claims: { role: 'citizen' } },
                now: Timestamp.fromMillis(1713350400000),
            });
            await submitReportFeedbackCore(db, {
                reportId,
                addressed: true,
                comment: 'Resolved after a call back',
                actor: { uid: 'citizen-1', claims: { role: 'citizen' } },
                now: Timestamp.fromMillis(1713350460000),
            });
            const feedbackSnap = await db.collection('report_feedback').doc(reportId).get();
            expect(feedbackSnap.data()).toMatchObject({
                addressed: true,
                comment: 'Resolved after a call back',
                submittedAt: 1713350400000,
                updatedAt: 1713350460000,
            });
            const allFeedback = await db.collection('report_feedback').get();
            expect(allFeedback.docs).toHaveLength(1);
        });
    });
    itif(available)('supports A → B → A correction cycle (idempotency removed for upsert semantics)', async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { reportId } = await seedReportAtStatus(db, 'resolved', {
                reporterUid: 'citizen-1',
            });
            // A
            await submitReportFeedbackCore(db, {
                reportId,
                addressed: true,
                comment: 'Feedback A',
                actor: { uid: 'citizen-1', claims: { role: 'citizen' } },
                now: Timestamp.fromMillis(1713350400000),
            });
            // B
            await submitReportFeedbackCore(db, {
                reportId,
                addressed: false,
                comment: 'Feedback B',
                actor: { uid: 'citizen-1', claims: { role: 'citizen' } },
                now: Timestamp.fromMillis(1713350460000),
            });
            // A again (correction back to original)
            await submitReportFeedbackCore(db, {
                reportId,
                addressed: true,
                comment: 'Feedback A',
                actor: { uid: 'citizen-1', claims: { role: 'citizen' } },
                now: Timestamp.fromMillis(1713350520000),
            });
            const feedbackSnap = await db.collection('report_feedback').doc(reportId).get();
            const data = feedbackSnap.data();
            expect(data.addressed).toBe(true);
            expect(data.comment).toBe('Feedback A');
            expect(data.submittedAt).toBe(1713350400000); // original submittedAt preserved
            expect(data.updatedAt).toBe(1713350520000); // updatedAt reflects latest correction
            const allFeedback = await db.collection('report_feedback').get();
            expect(allFeedback.docs).toHaveLength(1);
        });
    });
});
//# sourceMappingURL=submit-report-feedback.test.js.map