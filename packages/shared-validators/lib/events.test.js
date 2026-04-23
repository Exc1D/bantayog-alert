import { describe, expect, it } from 'vitest';
import { reportEventSchema, dispatchEventSchema } from './events.js';
const ts = 1713350400000;
describe('reportEventSchema', () => {
    it('accepts a valid report event', () => {
        expect(reportEventSchema.parse({
            reportId: 'r-1',
            municipalityId: 'daet',
            actor: 'admin-1',
            actorRole: 'municipal_admin',
            fromStatus: 'new',
            toStatus: 'awaiting_verify',
            createdAt: ts,
            correlationId: 'c-1',
            schemaVersion: 1,
        })).toMatchObject({ toStatus: 'awaiting_verify' });
    });
    it('rejects invalid actorRole', () => {
        expect(() => reportEventSchema.parse({
            reportId: 'r-1',
            municipalityId: 'daet',
            actor: 'admin-1',
            actorRole: 'super_admin', // invalid
            fromStatus: 'new',
            toStatus: 'awaiting_verify',
            createdAt: ts,
            correlationId: 'c-1',
            schemaVersion: 1,
        })).toThrow();
    });
});
describe('dispatchEventSchema', () => {
    it('accepts a valid dispatch event', () => {
        expect(dispatchEventSchema.parse({
            dispatchId: 'd-1',
            reportId: 'r-1',
            actor: 'resp-1',
            actorRole: 'responder',
            fromStatus: 'pending',
            toStatus: 'accepted',
            createdAt: ts,
            correlationId: 'c-1',
            schemaVersion: 1,
        })).toMatchObject({ toStatus: 'accepted' });
    });
    it('rejects invalid fromStatus', () => {
        expect(() => dispatchEventSchema.parse({
            dispatchId: 'd-1',
            reportId: 'r-1',
            actor: 'resp-1',
            actorRole: 'responder',
            fromStatus: 'invalid',
            toStatus: 'accepted',
            createdAt: ts,
            correlationId: 'c-1',
            schemaVersion: 1,
        })).toThrow();
    });
});
//# sourceMappingURL=events.test.js.map