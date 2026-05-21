import { beforeEach, describe, expect, it, vi } from 'vitest';
const mockInsert = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetEntries = vi.hoisted(() => vi.fn().mockResolvedValue([[]]));
vi.mock('@google-cloud/logging', () => ({
    Logging: class {
        log() {
            return { getEntries: mockGetEntries };
        }
    },
}));
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
import { auditExportBatchCore } from '../audit-export-batch.js';
beforeEach(() => {
    mockInsert.mockClear();
    mockGetEntries.mockClear();
});
describe('auditExportBatchCore', () => {
    it('returns 0 when no log entries exist', async () => {
        mockGetEntries.mockResolvedValueOnce([[]]);
        const result = await auditExportBatchCore({
            bqTable: { insert: mockInsert },
            loggingLog: { getEntries: mockGetEntries },
        });
        expect(result.exported).toBe(0);
        expect(mockInsert).not.toHaveBeenCalled();
    });
    it('inserts mapped rows into BigQuery', async () => {
        mockGetEntries.mockResolvedValueOnce([
            [
                {
                    metadata: {
                        logName: 'test-log',
                        resource: { type: 'global' },
                        timestamp: '2024-01-01T00:00:00Z',
                    },
                    data: { action: 'login' },
                },
            ],
        ]);
        const result = await auditExportBatchCore({
            bqTable: { insert: mockInsert },
            loggingLog: { getEntries: mockGetEntries },
        });
        expect(result.exported).toBe(1);
        expect(mockInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                logName: 'test-log',
                resource: JSON.stringify({ type: 'global' }),
                payload: JSON.stringify({ action: 'login' }),
                timestamp: '2024-01-01T00:00:00Z',
            }),
        ]);
    });
    // Gap 7: BQ insert failure must propagate so scheduled function retries
    it('throws when BigQuery insert fails', async () => {
        mockGetEntries.mockResolvedValueOnce([
            [
                {
                    metadata: { logName: 'test-log', resource: {}, timestamp: '2024-01-01T00:00:00Z' },
                    data: {},
                },
            ],
        ]);
        mockInsert.mockRejectedValueOnce(new Error('bq insert failed'));
        await expect(auditExportBatchCore({
            bqTable: { insert: mockInsert },
            loggingLog: { getEntries: mockGetEntries },
        })).rejects.toThrow('BigQuery insert failed');
        expect(mockInsert).toHaveBeenCalled();
    });
});
//# sourceMappingURL=audit-export-batch.test.js.map