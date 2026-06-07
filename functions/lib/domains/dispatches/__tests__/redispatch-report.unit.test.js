import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockWithIdempotency = vi.hoisted(() => vi.fn(async (_db, _opts, op) => {
    return { result: await op(), fromCache: false };
}));
const mockCheckRateLimit = vi.hoisted(() => vi.fn(() => Promise.resolve({ allowed: true, retryAfterSeconds: 0 })));
const mockLogDimension = vi.hoisted(() => vi.fn(() => vi.fn()));
vi.mock('../../../idempotency/guard.js', () => ({
    withIdempotency: mockWithIdempotency,
}));
vi.mock('../../shared/rate-limit.js', () => ({
    checkRateLimit: mockCheckRateLimit,
}));
vi.mock('@bantayog/shared-validators', async () => {
    const actual = await vi.importActual('@bantayog/shared-validators');
    return {
        ...actual,
        logDimension: mockLogDimension,
    };
});
import { redispatchReportSchema, redispatchReportCore, } from '../redispatch-report.js';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
function createMockDb(seed) {
    const txGetFn = vi.fn((ref) => {
        if (seed?.oldDispatch && ref.path?.startsWith('dispatches/')) {
            return Promise.resolve({
                exists: true,
                data: () => seed.oldDispatch,
                id: 'old-dispatch-1',
            });
        }
        if (seed?.report && ref.path?.startsWith('reports/')) {
            return Promise.resolve({
                exists: true,
                data: () => seed.report,
                id: seed.report.reportId ?? 'report-1',
            });
        }
        if (seed?.responder && ref.path?.startsWith('responders/')) {
            return Promise.resolve({
                exists: true,
                data: () => seed.responder,
                id: 'responder-1',
            });
        }
        return Promise.resolve({ exists: false, data: () => null });
    });
    const txUpdateFn = vi.fn().mockResolvedValue(undefined);
    const txSetFn = vi.fn().mockResolvedValue(undefined);
    let dispatchDocCounter = 0;
    let reportEventDocCounter = 0;
    const docFn = vi.fn((id) => {
        const isDispatch = id?.startsWith('report-') && id.includes('_');
        if (isDispatch) {
            dispatchDocCounter++;
            return {
                id: id ?? `dispatch-${String(dispatchDocCounter)}`,
                path: `dispatches/${id ?? 'auto'}`,
                get: vi.fn().mockResolvedValue({
                    exists: dispatchDocCounter > 1,
                    data: () => ({}),
                }),
                update: txUpdateFn,
                set: txSetFn,
            };
        }
        if (id === undefined) {
            reportEventDocCounter++;
            return {
                id: `event-${String(reportEventDocCounter)}`,
                path: 'report_events/auto',
                set: txSetFn,
            };
        }
        return {
            id: id || 'auto-id',
            path: `reports/${id}`,
            update: txUpdateFn,
            set: txSetFn,
        };
    });
    const collectionFn = vi.fn((name) => ({
        doc: (id) => {
            const d = docFn(id);
            if (id !== undefined) {
                d.path = `${name}/${id}`;
            }
            return d;
        },
    }));
    const runTransaction = vi.fn(async (callback) => callback({
        get: txGetFn,
        update: txUpdateFn,
        set: txSetFn,
    }));
    return {
        collection: collectionFn,
        runTransaction,
        _txGet: txGetFn,
        _txUpdate: txUpdateFn,
        _txSet: txSetFn,
        _collectionFn: collectionFn,
    };
}
const mockTimestamp = {
    toMillis: () => 1713350400000,
};
describe('redispatchReportSchema', () => {
    it('accepts a well-formed request', () => {
        const result = redispatchReportSchema.parse({
            oldDispatchId: 'dispatch-abc-123',
            newResponderUid: 'responder-xyz-789',
            reason: 'Original responder unavailable',
            idempotencyKey: '00000000-0000-4000-8000-000000000001',
        });
        expect(result).toEqual({
            oldDispatchId: 'dispatch-abc-123',
            newResponderUid: 'responder-xyz-789',
            reason: 'Original responder unavailable',
            idempotencyKey: '00000000-0000-4000-8000-000000000001',
        });
    });
    it('rejects empty oldDispatchId', () => {
        expect(() => redispatchReportSchema.parse({
            oldDispatchId: '',
            newResponderUid: 'responder-1',
            reason: 'Test',
            idempotencyKey: crypto.randomUUID(),
        })).toThrow();
    });
    it('rejects non-UUID idempotencyKey', () => {
        expect(() => redispatchReportSchema.parse({
            oldDispatchId: 'dispatch-1',
            newResponderUid: 'responder-1',
            reason: 'Test',
            idempotencyKey: 'not-a-uuid',
        })).toThrow();
    });
    it('rejects reason over 500 chars', () => {
        expect(() => redispatchReportSchema.parse({
            oldDispatchId: 'dispatch-1',
            newResponderUid: 'responder-1',
            reason: 'x'.repeat(501),
            idempotencyKey: crypto.randomUUID(),
        })).toThrow();
    });
});
describe('redispatchReportCore', () => {
    let mockDb;
    const baseDeps = {
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
        actor: {
            uid: 'admin-1',
            claims: { role: 'municipal_admin', municipalityId: 'daet' },
        },
        now: mockTimestamp,
    };
    beforeEach(() => {
        mockDb = createMockDb();
        mockWithIdempotency.mockClear();
        mockCheckRateLimit.mockClear();
        mockLogDimension.mockClear();
    });
    it('throws when old dispatch is not found', async () => {
        await expect(redispatchReportCore(mockDb, {
            ...baseDeps,
            oldDispatchId: 'missing',
            newResponderUid: 'responder-1',
            reason: 'Test',
        })).rejects.toThrow(BantayogError);
        try {
            await redispatchReportCore(mockDb, {
                ...baseDeps,
                oldDispatchId: 'missing',
                newResponderUid: 'responder-1',
                reason: 'Test',
            });
        }
        catch (err) {
            expect(err).toBeInstanceOf(BantayogError);
            expect(err.code).toBe(BantayogErrorCode.NOT_FOUND);
            expect(err.message).toContain('Old dispatch not found');
        }
    });
    it('throws when old dispatch is not in terminal state', async () => {
        mockDb = createMockDb({
            oldDispatch: {
                status: 'pending',
                reportId: 'report-1',
                assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
            },
        });
        await expect(redispatchReportCore(mockDb, {
            ...baseDeps,
            oldDispatchId: 'old-dispatch-1',
            newResponderUid: 'responder-2',
            reason: 'Test',
        })).rejects.toSatisfy((err) => {
            if (!(err instanceof BantayogError))
                return false;
            return (err.code === BantayogErrorCode.FAILED_PRECONDITION &&
                err.message.includes('Cannot redispatch from status pending'));
        });
    });
    it('throws when report is not found', async () => {
        mockDb = createMockDb({
            oldDispatch: {
                status: 'declined',
                reportId: 'missing-report',
                assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
            },
        });
        await expect(redispatchReportCore(mockDb, {
            ...baseDeps,
            oldDispatchId: 'old-dispatch-1',
            newResponderUid: 'responder-2',
            reason: 'Test',
        })).rejects.toSatisfy((err) => {
            if (!(err instanceof BantayogError))
                return false;
            return err.code === BantayogErrorCode.NOT_FOUND && err.message.includes('Report not found');
        });
    });
    it('throws when report is not verified', async () => {
        mockDb = createMockDb({
            oldDispatch: {
                status: 'declined',
                reportId: 'report-1',
                assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
            },
            report: {
                status: 'new',
                municipalityId: 'daet',
                reportId: 'report-1',
            },
        });
        await expect(redispatchReportCore(mockDb, {
            ...baseDeps,
            oldDispatchId: 'old-dispatch-1',
            newResponderUid: 'responder-2',
            reason: 'Test',
        })).rejects.toSatisfy((err) => {
            if (!(err instanceof BantayogError))
                return false;
            return (err.code === BantayogErrorCode.FAILED_PRECONDITION &&
                err.message.includes('Report must be verified'));
        });
    });
    it('throws when responder is not found', async () => {
        mockDb = createMockDb({
            oldDispatch: {
                status: 'declined',
                reportId: 'report-1',
                assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
            },
            report: {
                status: 'verified',
                municipalityId: 'daet',
                reportId: 'report-1',
                severityDerived: 'high',
            },
        });
        await expect(redispatchReportCore(mockDb, {
            ...baseDeps,
            oldDispatchId: 'old-dispatch-1',
            newResponderUid: 'missing-responder',
            reason: 'Test',
        })).rejects.toSatisfy((err) => {
            if (!(err instanceof BantayogError))
                return false;
            return err.code === BantayogErrorCode.NOT_FOUND && err.message.includes('Responder not found');
        });
    });
    it('throws when responder is not active', async () => {
        mockDb = createMockDb({
            oldDispatch: {
                status: 'declined',
                reportId: 'report-1',
                assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
            },
            report: {
                status: 'verified',
                municipalityId: 'daet',
                reportId: 'report-1',
                severityDerived: 'high',
            },
            responder: {
                agencyId: 'bfp',
                municipalityId: 'daet',
                isActive: false,
            },
        });
        await expect(redispatchReportCore(mockDb, {
            ...baseDeps,
            oldDispatchId: 'old-dispatch-1',
            newResponderUid: 'responder-2',
            reason: 'Test',
        })).rejects.toSatisfy((err) => {
            if (!(err instanceof BantayogError))
                return false;
            return (err.code === BantayogErrorCode.INVALID_STATUS_TRANSITION &&
                err.message.includes('Responder is not active'));
        });
    });
    it('throws when responder is in different municipality', async () => {
        mockDb = createMockDb({
            oldDispatch: {
                status: 'declined',
                reportId: 'report-1',
                assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
            },
            report: {
                status: 'verified',
                municipalityId: 'daet',
                reportId: 'report-1',
                severityDerived: 'high',
            },
            responder: {
                agencyId: 'bfp',
                municipalityId: 'basud',
                isActive: true,
            },
        });
        await expect(redispatchReportCore(mockDb, {
            ...baseDeps,
            oldDispatchId: 'old-dispatch-1',
            newResponderUid: 'responder-2',
            reason: 'Test',
        })).rejects.toSatisfy((err) => {
            if (!(err instanceof BantayogError))
                return false;
            return (err.code === BantayogErrorCode.FORBIDDEN &&
                err.message.includes('Responder not in report municipality'));
        });
    });
    it('succeeds and creates new dispatch for valid redispatch', async () => {
        mockDb = createMockDb({
            oldDispatch: {
                status: 'declined',
                reportId: 'report-1',
                assignedTo: { uid: 'r1', agencyId: 'bfp', municipalityId: 'daet' },
            },
            report: {
                status: 'verified',
                municipalityId: 'daet',
                reportId: 'report-1',
                severityDerived: 'high',
            },
            responder: {
                agencyId: 'mdrrmo',
                municipalityId: 'daet',
                isActive: true,
            },
        });
        const result = await redispatchReportCore(mockDb, {
            ...baseDeps,
            oldDispatchId: 'old-dispatch-1',
            newResponderUid: 'responder-2',
            reason: 'Original responder declined',
        });
        expect(result).toEqual({
            newDispatchId: 'report-1_responder-2',
            status: 'pending',
            reportId: 'report-1',
        });
        // Verify old dispatch was updated
        expect(mockDb._txUpdate).toHaveBeenCalled();
        const oldDispatchUpdate = mockDb._txUpdate.mock.calls.find((call) => call[0].path === 'dispatches/old-dispatch-1');
        expect(oldDispatchUpdate).toBeDefined();
        // Verify report was updated to assigned
        const reportUpdate = mockDb._txUpdate.mock.calls.find((call) => call[0].path === 'reports/report-1');
        expect(reportUpdate).toBeDefined();
        expect(reportUpdate[1]).toMatchObject({
            status: 'assigned',
            currentDispatchId: 'report-1_responder-2',
        });
        // Verify dispatch event was created
        expect(mockDb._txSet).toHaveBeenCalled();
    });
});
//# sourceMappingURL=redispatch-report.unit.test.js.map