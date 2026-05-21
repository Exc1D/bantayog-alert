import { beforeEach, describe, expect, it, vi } from 'vitest';
const mockInsert = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockAdd = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 'dl-1' }));
vi.mock('@google-cloud/bigquery', () => ({
    BigQuery: class {
        dataset() {
            return {
                table() {
                    return { insert: mockInsert };
                },
            };
        }
    },
}));
vi.mock('../../../admin-init.js', () => ({
    adminDb: {
        collection: vi.fn(() => ({
            add: mockAdd,
        })),
    },
}));
import { streamAuditEvent } from '../audit-stream.js';
beforeEach(() => {
    mockInsert.mockClear();
    mockAdd.mockClear();
    mockAdd.mockResolvedValue({ id: 'dl-1' });
});
describe('streamAuditEvent', () => {
    it('skips BigQuery and dead letters in the functions emulator', async () => {
        const originalFunctionsEmulator = process.env.FUNCTIONS_EMULATOR;
        process.env.FUNCTIONS_EMULATOR = 'true';
        try {
            await streamAuditEvent({
                eventType: 'test_event',
                actorUid: 'uid-1',
                occurredAt: 1713350400000,
            });
            expect(mockInsert).not.toHaveBeenCalled();
            expect(mockAdd).not.toHaveBeenCalled();
        }
        finally {
            if (originalFunctionsEmulator === undefined) {
                delete process.env.FUNCTIONS_EMULATOR;
            }
            else {
                process.env.FUNCTIONS_EMULATOR = originalFunctionsEmulator;
            }
        }
    });
    it('inserts the event into BigQuery without throwing on success', async () => {
        mockInsert.mockResolvedValueOnce(undefined);
        await streamAuditEvent({
            eventType: 'test_event',
            actorUid: 'uid-1',
            occurredAt: 1713350400000,
        });
        expect(mockInsert).toHaveBeenCalledWith([
            expect.objectContaining({ eventType: 'test_event', actorUid: 'uid-1' }),
        ]);
    });
    it('does not throw when BigQuery insert fails', async () => {
        mockInsert.mockRejectedValueOnce(new Error('bq down'));
        await expect(streamAuditEvent({
            eventType: 'test_event',
            actorUid: 'uid-1',
            occurredAt: 1713350400000,
        })).resolves.toBeUndefined();
    });
    // Gap 9: Full AuditStreamEvent contract
    it('forwards all event fields to BigQuery', async () => {
        mockInsert.mockResolvedValueOnce(undefined);
        await streamAuditEvent({
            eventType: 'erasure_completed',
            actorUid: 'system',
            sessionId: 'sess-1',
            targetCollection: 'reports',
            targetDocumentId: 'doc-1',
            metadata: { reason: 'test' },
            occurredAt: 1713350400000,
        });
        expect(mockInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                eventType: 'erasure_completed',
                actorUid: 'system',
                sessionId: 'sess-1',
                targetCollection: 'reports',
                targetDocumentId: 'doc-1',
                metadata: { reason: 'test' },
                occurredAt: 1713350400000,
            }),
        ]);
    });
    it('writes dead letter when BigQuery insert fails', async () => {
        mockInsert.mockRejectedValueOnce(new Error('bq down'));
        await streamAuditEvent({
            eventType: 'test_event',
            actorUid: 'uid-1',
            occurredAt: 1713350400000,
        });
        expect(mockAdd).toHaveBeenCalledOnce();
        expect(mockAdd).toHaveBeenCalledWith({
            category: 'audit_stream',
            status: 'failed_to_stream',
            payload: {
                eventType: 'test_event',
                actorUid: 'uid-1',
                occurredAt: 1713350400000,
            },
            createdAt: expect.any(Number),
            error: 'bq down',
        });
    });
    it('does not write dead letter on success', async () => {
        mockInsert.mockResolvedValueOnce(undefined);
        await streamAuditEvent({
            eventType: 'test_event',
            actorUid: 'uid-1',
            occurredAt: 1713350400000,
        });
        expect(mockAdd).not.toHaveBeenCalled();
    });
    it('survives dead-letter write failure without throwing', async () => {
        mockInsert.mockRejectedValueOnce(new Error('bq down'));
        mockAdd.mockRejectedValueOnce(new Error('firestore down'));
        await expect(streamAuditEvent({
            eventType: 'test_event',
            actorUid: 'uid-1',
            occurredAt: 1713350400000,
        })).resolves.toBeUndefined();
    });
});
//# sourceMappingURL=audit-stream.test.js.map