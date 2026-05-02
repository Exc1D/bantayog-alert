import { beforeEach, describe, expect, it, vi } from 'vitest';
const mockQuery = vi.hoisted(() => vi.fn());
const mockSet = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSend = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
function createMockDeps() {
    const db = {
        doc: vi.fn(() => ({ set: mockSet })),
    };
    const messaging = {
        send: mockSend,
    };
    return { db, messaging };
}
import { auditExportHealthCheckCore } from '../../triggers/audit-export-health-check.js';
beforeEach(() => {
    mockQuery.mockReset();
    mockSet.mockClear();
    mockSend.mockClear();
});
describe('auditExportHealthCheckCore', () => {
    it('marks healthy when gaps are within thresholds', async () => {
        const now = 1713350400000;
        mockQuery
            .mockResolvedValueOnce([[{ lastAt: { value: String(now - 30000) } }]])
            .mockResolvedValueOnce([[{ lastAt: { value: new Date(now - 300000).toISOString() } }]]);
        const { db, messaging } = createMockDeps();
        const result = await auditExportHealthCheckCore(db, messaging, {
            query: mockQuery,
            now: () => now,
        });
        expect(result.healthy).toBe(true);
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ healthy: true }));
    });
    it('marks unhealthy and sends FCM alert when streaming gap exceeds threshold', async () => {
        const now = 1713350400000;
        mockQuery
            .mockResolvedValueOnce([[{ lastAt: { value: String(now - 120000) } }]])
            .mockResolvedValueOnce([[{ lastAt: { value: new Date(now - 300000).toISOString() } }]]);
        const { db, messaging } = createMockDeps();
        const result = await auditExportHealthCheckCore(db, messaging, {
            query: mockQuery,
            now: () => now,
        });
        expect(result.healthy).toBe(false);
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ healthy: false }));
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            topic: 'superadmin-alerts',
            notification: expect.objectContaining({ title: 'Audit pipeline health alert' }),
        }));
    });
    it('marks unhealthy when batch gap exceeds 900s threshold', async () => {
        const now = 1713350400000;
        mockQuery
            .mockResolvedValueOnce([[{ lastAt: { value: String(now - 30000) } }]])
            .mockResolvedValueOnce([[{ lastAt: { value: new Date(now - 1000000).toISOString() } }]]);
        const { db, messaging } = createMockDeps();
        const result = await auditExportHealthCheckCore(db, messaging, {
            query: mockQuery,
            now: () => now,
        });
        expect(result.healthy).toBe(false);
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ healthy: false }));
        expect(result.batchGapSeconds).toBeGreaterThanOrEqual(900);
        expect(mockSend).toHaveBeenCalled();
    });
});
//# sourceMappingURL=audit-export-health-check.test.js.map