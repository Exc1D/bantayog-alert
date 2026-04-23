import { describe, it, expect, vi } from 'vitest';
// Mock rtdb before importing callable modules that depend on firebase-admin.ts
vi.mock('firebase-admin/database', () => ({
    getDatabase: vi.fn(() => ({})),
}));
import { acceptDispatchRequestSchema } from '../../callables/accept-dispatch.js';
describe('acceptDispatchRequestSchema', () => {
    it('accepts a well-formed request', () => {
        expect(acceptDispatchRequestSchema.parse({
            dispatchId: 'disp-abc-123',
            idempotencyKey: '00000000-0000-4000-8000-000000000001',
        })).toEqual({
            dispatchId: 'disp-abc-123',
            idempotencyKey: '00000000-0000-4000-8000-000000000001',
        });
    });
    it('rejects empty dispatchId', () => {
        expect(() => acceptDispatchRequestSchema.parse({ dispatchId: '', idempotencyKey: crypto.randomUUID() })).toThrow();
    });
    it('rejects non-UUID idempotencyKey', () => {
        expect(() => acceptDispatchRequestSchema.parse({ dispatchId: 'd', idempotencyKey: 'not-a-uuid' })).toThrow();
    });
});
//# sourceMappingURL=accept-dispatch.unit.test.js.map