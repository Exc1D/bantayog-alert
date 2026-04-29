/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { erasureSweepCore } from '../../triggers/erasure-sweep.js';
const mockUpdateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockGetFiles = vi.fn().mockResolvedValue([[]]);
const mockDeleteFile = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase-admin/auth', () => ({
    getAuth: () => ({ updateUser: mockUpdateUser, deleteUser: mockDeleteUser }),
}));
vi.mock('firebase-admin/storage', () => ({
    getStorage: () => ({
        bucket: () => ({
            getFiles: mockGetFiles,
            file: (path) => ({
                delete: () => mockDeleteFile(path),
            }),
        }),
    }),
}));
vi.mock('../../services/audit-stream.js', () => ({ streamAuditEvent: vi.fn() }));
let env;
async function seedApprovedRequest(db, id, citizenUid, status = 'approved_pending_anonymization', legalHold = false) {
    await db.collection('erasure_requests').doc(id).set({
        citizenUid,
        status,
        legalHold,
        requestedAt: Date.now(),
    });
    await db.collection('erasure_active').doc(citizenUid).set({ citizenUid, createdAt: Date.now() });
    // Seed a report and report_private for this citizen
    await db.collection('reports').doc('report-1').set({
        submittedBy: citizenUid,
        verified: false,
        municipalityId: 'daet',
        status: 'pending',
    });
    await db
        .collection('report_private')
        .doc('report-1')
        .set({
        citizenName: 'Juan dela Cruz',
        rawPhone: '+639171234567',
        gpsExact: { lat: 14.1, lng: 122.9 },
        addressText: '123 Main St',
        reportId: 'report-1',
    });
    await db.collection('report_contacts').doc('report-1').set({
        email: 'juan@example.com',
        phone: '+639171234567',
        reportId: 'report-1',
    });
}
beforeEach(async () => {
    mockUpdateUser.mockReset();
    mockDeleteUser.mockReset();
    mockGetFiles.mockReset();
    mockUpdateUser.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
    mockGetFiles.mockResolvedValue([[]]);
    env = await initializeTestEnvironment({
        projectId: 'demo-8c-sweep',
        firestore: { host: 'localhost', port: 8081 },
    });
    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        for (const col of [
            'erasure_requests',
            'erasure_active',
            'reports',
            'report_private',
            'report_contacts',
        ]) {
            const snap = await db.collection(col).get();
            await Promise.all(snap.docs.map((d) => d.ref.delete()));
        }
    });
});
afterEach(async () => {
    await env?.cleanup();
});
describe('erasureSweepCore', () => {
    it('anonymizes report fields and deletes Auth on approved request', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            const { getStorage } = await import('firebase-admin/storage');
            await seedApprovedRequest(db, 'req-1', 'uid-citizen');
            const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() });
            expect(result.processed).toBe(1);
            // Reports anonymized
            const reportSnap = await db.collection('reports').doc('report-1').get();
            expect(reportSnap.data().submittedBy).toBe('citizen_deleted');
            expect(reportSnap.data().mediaRedacted).toBe(true);
            // report_private PII nulled
            const privateSnap = await db.collection('report_private').doc('report-1').get();
            expect(privateSnap.data().citizenName).toBeNull();
            expect(privateSnap.data().rawPhone).toBeNull();
            // report_contacts nulled
            const contactSnap = await db.collection('report_contacts').doc('report-1').get();
            expect(contactSnap.data().email).toBeNull();
            // Auth deleted (last)
            expect(mockDeleteUser).toHaveBeenCalledWith('uid-citizen');
            // Sentinel deleted
            const sentinel = await db.collection('erasure_active').doc('uid-citizen').get();
            expect(sentinel.exists).toBe(false);
            // Status completed
            const reqSnap = await db.collection('erasure_requests').doc('req-1').get();
            expect(reqSnap.data().status).toBe('completed');
        });
    });
    it('skips records with legalHold === true', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            const { getStorage } = await import('firebase-admin/storage');
            await seedApprovedRequest(db, 'req-held', 'uid-held', 'approved_pending_anonymization', true);
            const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() });
            expect(result.processed).toBe(0);
            expect(result.skippedHeld).toBe(1);
            expect(mockDeleteUser).not.toHaveBeenCalled();
        });
    });
    it('skips reports with no submittedBy (pseudonymous)', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            const { getStorage } = await import('firebase-admin/storage');
            await seedApprovedRequest(db, 'req-pseudo', 'uid-pseudo');
            // Add a pseudonymous report (no submittedBy matching uid)
            await db.collection('reports').doc('pseudo-report').set({
                municipalityId: 'daet',
                status: 'pending',
                verified: false,
            });
            const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() });
            expect(result.processed).toBe(1);
            // pseudo-report is not touched
            const pseudoSnap = await db.collection('reports').doc('pseudo-report').get();
            expect(pseudoSnap.data().submittedBy).toBeUndefined();
        });
    });
    it('dead-letters and re-enables Auth on failure, fires CRITICAL alert if re-enable fails', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            const { getStorage } = await import('firebase-admin/storage');
            await seedApprovedRequest(db, 'req-fail', 'uid-fail');
            // Force Auth delete to throw
            mockDeleteUser.mockRejectedValueOnce(new Error('auth error'));
            const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() });
            expect(result.deadLettered).toBe(1);
            const reqSnap = await db.collection('erasure_requests').doc('req-fail').get();
            expect(reqSnap.data().status).toBe('dead_lettered');
            expect(reqSnap.data().deadLetterReason).toContain('auth error');
            // Auth re-enable was attempted
            expect(mockUpdateUser).toHaveBeenCalledWith('uid-fail', { disabled: false });
        });
    });
    it('re-claims stale executing record (>30min) with new sweepRunId', async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            const db = ctx.firestore();
            const { getAuth } = await import('firebase-admin/auth');
            const { getStorage } = await import('firebase-admin/storage');
            const staleAt = Date.now() - 31 * 60 * 1000;
            await db
                .collection('erasure_requests')
                .doc('req-stale')
                .set({
                citizenUid: 'uid-stale',
                status: 'executing',
                legalHold: false,
                sweepRunId: 'old-run-id',
                executionStartedAt: staleAt,
                requestedAt: staleAt - 1000,
            });
            await db
                .collection('erasure_active')
                .doc('uid-stale')
                .set({ citizenUid: 'uid-stale', createdAt: staleAt });
            const result = await erasureSweepCore({ db, auth: getAuth(), storage: getStorage() });
            expect(result.processed).toBe(1);
            const reqSnap = await db.collection('erasure_requests').doc('req-stale').get();
            expect(reqSnap.data().sweepRunId).not.toBe('old-run-id');
            expect(reqSnap.data().status).toBe('completed');
        });
    });
});
//# sourceMappingURL=erasure-sweep.test.js.map