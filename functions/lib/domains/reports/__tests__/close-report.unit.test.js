import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockWithIdempotency = vi.hoisted(() => vi.fn(async (_db, _opts, op) => {
    return { result: await op(), fromCache: false };
}));
const mockLogDimension = vi.hoisted(() => vi.fn(() => vi.fn()));
const mockIsValidReportTransition = vi.hoisted(() => vi.fn(() => true));
vi.mock('../../../idempotency/guard.js', () => ({
    withIdempotency: mockWithIdempotency,
}));
vi.mock('@bantayog/shared-validators', async () => {
    const actual = await vi.importActual('@bantayog/shared-validators');
    return {
        ...actual,
        logDimension: mockLogDimension,
        isValidReportTransition: mockIsValidReportTransition,
    };
});
import { closeReportRequestSchema, closeReportCore } from '../close-report.js';
function createMockDb(seedReport) {
    const txGetFn = vi.fn((ref) => {
        if (seedReport && ref.path === `reports/${seedReport.reportId}`) {
            return Promise.resolve({
                exists: true,
                data: () => ({ ...seedReport }),
            });
        }
        return Promise.resolve({ exists: false, data: () => null });
    });
    const txUpdateFn = vi.fn().mockResolvedValue(undefined);
    const txSetFn = vi.fn().mockResolvedValue(undefined);
    let eventDocCounter = 0;
    const docFn = vi.fn((id) => ({
        path: id?.includes('/') ? id : `reports/${id ?? 'auto-id'}`,
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
        update: txUpdateFn,
        set: txSetFn,
    }));
    const collectionFn = vi.fn((name) => ({
        doc: (id) => {
            if (name === 'report_events' && id === undefined) {
                // Called as collection('report_events').doc() — auto-id
                eventDocCounter++;
                return {
                    id: `event-${String(eventDocCounter)}`,
                    path: 'report_events/event-new',
                    set: txSetFn,
                };
            }
            const d = docFn(id);
            d.path = `${name}/${id ?? 'auto-id'}`;
            return d;
        },
        where: vi.fn(() => ({ where: vi.fn(), get: vi.fn().mockResolvedValue({ docs: [] }) })),
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
describe('closeReportRequestSchema', () => {
    it('accepts well-formed request', () => {
        const result = closeReportRequestSchema.parse({
            reportId: 'report-abc123',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            closureSummary: 'Resolved by municipal admin.',
        });
        expect(result).toEqual({
            reportId: 'report-abc123',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            closureSummary: 'Resolved by municipal admin.',
        });
    });
    it('rejects missing reportId', () => {
        expect(() => closeReportRequestSchema.parse({
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        })).toThrow();
    });
    it('rejects non-UUID idempotencyKey', () => {
        expect(() => closeReportRequestSchema.parse({
            reportId: 'report-abc123',
            idempotencyKey: 'not-a-uuid',
            closureSummary: 'Resolved.',
        })).toThrow();
    });
    it('rejects whitespace-only closureSummary', () => {
        expect(() => closeReportRequestSchema.parse({
            reportId: 'report-abc123',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            closureSummary: '   ',
        })).toThrow();
    });
    it('rejects too-long closureSummary (> 2000 chars)', () => {
        expect(() => closeReportRequestSchema.parse({
            reportId: 'report-abc123',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            closureSummary: 'x'.repeat(2001),
        })).toThrow();
    });
});
describe('closeReportCore', () => {
    let mockDb;
    beforeEach(() => {
        mockDb = createMockDb();
        mockWithIdempotency.mockClear();
        mockLogDimension.mockClear();
        mockIsValidReportTransition.mockClear();
    });
    it('transitions resolved report to closed and writes event', async () => {
        mockDb = createMockDb({
            reportId: 'rep-1',
            status: 'resolved',
            municipalityId: 'daet',
        });
        const result = await closeReportCore(mockDb, {
            reportId: 'rep-1',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        });
        expect(result.status).toBe('closed');
        expect(result.reportId).toBe('rep-1');
        // Report updated
        expect(mockDb._txUpdate).toHaveBeenCalled();
        const updateCall = mockDb._txUpdate.mock.calls.find((c) => c[0].path === 'reports/rep-1');
        expect(updateCall).toBeDefined();
        expect(updateCall[1].status).toBe('closed');
        expect(updateCall[1].lastStatusAt).toBe(1713350400000);
        expect(updateCall[1].lastStatusBy).toBe('admin-1');
        // Event written
        expect(mockDb._txSet).toHaveBeenCalled();
        const eventCall = mockDb._txSet.mock.calls.find((c) => c[0].path?.startsWith('report_events/') ??
            c[0].id?.startsWith('event-'));
        expect(eventCall).toBeDefined();
        const eventData = eventCall[1];
        expect(eventData.from).toBe('resolved');
        expect(eventData.to).toBe('closed');
        expect(eventData.reportId).toBe('rep-1');
        expect(eventData.actor).toBe('admin-1');
        expect(eventData.actorRole).toBe('municipal_admin');
    });
    it('stores closureSummary when provided', async () => {
        mockDb = createMockDb({
            reportId: 'rep-2',
            status: 'resolved',
            municipalityId: 'daet',
        });
        await closeReportCore(mockDb, {
            reportId: 'rep-2',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            closureSummary: 'All responders stood down.',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        });
        const updateCall = mockDb._txUpdate.mock.calls.find((c) => c[0].path === 'reports/rep-2');
        expect(updateCall[1].closureSummary).toBe('All responders stood down.');
    });
    it('omits closureSummary key when undefined', async () => {
        mockDb = createMockDb({
            reportId: 'rep-3',
            status: 'resolved',
            municipalityId: 'daet',
        });
        await closeReportCore(mockDb, {
            reportId: 'rep-3',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        });
        const updateCall = mockDb._txUpdate.mock.calls.find((c) => c[0].path === 'reports/rep-3');
        expect(Object.prototype.hasOwnProperty.call(updateCall[1], 'closureSummary')).toBe(false);
    });
    it('throws NOT_FOUND when report does not exist', async () => {
        mockDb = createMockDb(); // no seed
        await expect(closeReportCore(mockDb, {
            reportId: 'missing-report',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
    it('throws FORBIDDEN when report is in a different municipality', async () => {
        mockDb = createMockDb({
            reportId: 'rep-4',
            status: 'resolved',
            municipalityId: 'mercedes',
        });
        await expect(closeReportCore(mockDb, {
            reportId: 'rep-4',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
    it('throws FAILED_PRECONDITION when report is not resolved', async () => {
        mockDb = createMockDb({
            reportId: 'rep-5',
            status: 'verified',
            municipalityId: 'daet',
        });
        await expect(closeReportCore(mockDb, {
            reportId: 'rep-5',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        })).rejects.toMatchObject({ code: 'FAILED_PRECONDITION' });
    });
    it('allows resolved→closed through the isValidReportTransition guard', async () => {
        // The real transition table includes resolved→closed, so this verifies
        // both the FAILED_PRECONDITION guard (from === 'resolved') and the
        // isValidReportTransition guard pass for the normal happy path.
        mockDb = createMockDb({
            reportId: 'rep-6',
            status: 'resolved',
            municipalityId: 'daet',
        });
        const result = await closeReportCore(mockDb, {
            reportId: 'rep-6',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        });
        expect(result.status).toBe('closed');
    });
    it('throws INVALID_STATUS_TRANSITION when transition is invalid', async () => {
        mockIsValidReportTransition.mockReturnValueOnce(false);
        mockDb = createMockDb({
            reportId: 'rep-invalid-transition',
            status: 'resolved',
            municipalityId: 'daet',
        });
        await expect(closeReportCore(mockDb, {
            reportId: 'rep-invalid-transition',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        })).rejects.toMatchObject({ code: 'INVALID_STATUS_TRANSITION' });
    });
    it('passes correct idempotency key to withIdempotency', async () => {
        mockDb = createMockDb({
            reportId: 'rep-7',
            status: 'resolved',
            municipalityId: 'daet',
        });
        await closeReportCore(mockDb, {
            reportId: 'rep-7',
            idempotencyKey: 'my-unique-key-123',
            actor: {
                uid: 'admin-1',
                claims: { role: 'municipal_admin', municipalityId: 'daet', active: true },
            },
            now: {
                toMillis: () => 1713350400000,
            },
        });
        expect(mockWithIdempotency).toHaveBeenCalledTimes(1);
        const callArgs = mockWithIdempotency.mock.calls[0];
        expect(callArgs[1].key).toBe('closeReport:admin-1:my-unique-key-123');
    });
    it('falls back to municipal_admin actorRole when claims.role is undefined', async () => {
        mockDb = createMockDb({
            reportId: 'rep-8',
            status: 'resolved',
            municipalityId: 'daet',
        });
        await closeReportCore(mockDb, {
            reportId: 'rep-8',
            idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
            actor: {
                uid: 'admin-super',
                claims: { municipalityId: 'daet', active: true }, // role intentionally omitted
            },
            now: {
                toMillis: () => 1713350400000,
            },
        });
        const eventCall = mockDb._txSet.mock.calls.find((c) => c[0].path?.startsWith('report_events/') ??
            c[0].id?.startsWith('event-'));
        expect(eventCall[1].actorRole).toBe('municipal_admin');
    });
});
//# sourceMappingURL=close-report.unit.test.js.map