import { beforeEach, describe, expect, it, vi } from 'vitest';
const mockInsert = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
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
import { streamAuditEvent } from '../../services/audit-stream.js';
beforeEach(() => {
    mockInsert.mockClear();
});
describe('streamAuditEvent', () => {
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
});
//# sourceMappingURL=audit-stream.test.js.map