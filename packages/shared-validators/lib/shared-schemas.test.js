import { describe, expect, it } from 'vitest';
import { agencyAssistanceRequestDocSchema } from './coordination.js';
import { hazardZoneDocSchema } from './hazard.js';
import { moderationIncidentDocSchema } from './moderation.js';
import { rateLimitDocSchema } from './rate-limits.js';
import { idempotencyKeyDocSchema } from './idempotency-keys.js';
import { deadLetterDocSchema } from './dead-letters.js';
import { alertDocSchema } from './alerts-emergencies.js';
import { hazardZoneDocSchema as exportedHazardZoneDocSchema, } from './index.js';
import * as exportedValidators from './index.js';
import * as hazardSchemas from './hazard.js';
const ts = 1713350400000;
describe('coordination schemas', () => {
    it('agency assistance expiresAt must be > createdAt', () => {
        expect(() => agencyAssistanceRequestDocSchema.parse({
            reportId: 'r',
            requestedByMunicipalId: 'a',
            requestedByMunicipality: 'daet',
            targetAgencyId: 'bfp',
            requestType: 'BFP',
            message: 'help',
            priority: 'urgent',
            status: 'pending',
            fulfilledByDispatchIds: [],
            createdAt: ts + 1000,
            expiresAt: ts,
        })).toThrow();
    });
});
describe('hazard schemas', () => {
    it('hazard zone requires polygonRef and bbox', () => {
        expect(() => hazardZoneDocSchema.parse({
            zoneType: 'reference',
            hazardType: 'flood',
            scope: 'provincial',
            version: 1,
            createdAt: ts,
            updatedAt: ts,
            schemaVersion: 1,
        })).toThrow();
    });
    it('does not export retired hazard signal schemas', () => {
        expect(exportedValidators).not.toHaveProperty('hazardSignalDocSchema');
        expect(exportedValidators).not.toHaveProperty('hazardSignalStatusDocSchema');
        expect(hazardSchemas).not.toHaveProperty('hazardSignalDocSchema');
        expect(hazardSchemas).not.toHaveProperty('hazardSignalStatusDocSchema');
        expect(exportedHazardZoneDocSchema).toBe(hazardZoneDocSchema);
    });
});
describe('rate limit schema', () => {
    it('accepts a window counter', () => {
        expect(rateLimitDocSchema.parse({
            key: 'citizen:submit:u-1',
            windowStartAt: ts,
            windowEndAt: ts + 60000,
            count: 3,
            limit: 10,
            updatedAt: ts,
        })).toMatchObject({ count: 3 });
    });
});
describe('idempotency key schema', () => {
    it('requires 64-char hex hash', () => {
        expect(() => idempotencyKeyDocSchema.parse({
            key: 'k',
            payloadHash: 'short',
            firstSeenAt: ts,
        })).toThrow();
    });
});
describe('dead letter schema', () => {
    it('accepts a failed inbox item', () => {
        expect(deadLetterDocSchema.parse({
            source: 'processInboxItem',
            originalDocRef: 'report_inbox/abc',
            failureReason: 'validation_error',
            payload: { x: 1 },
            attempts: 3,
            firstSeenAt: ts,
            lastSeenAt: ts,
        })).toMatchObject({ attempts: 3 });
    });
});
describe('alerts/emergencies schemas', () => {
    it('alert requires targetMunicipalityIds array', () => {
        expect(() => alertDocSchema.parse({
            title: 'x',
            body: 'y',
            severity: 'high',
            sentAt: ts,
            publishedBy: 'super-1',
        })).toThrow();
    });
});
describe('moderation schema', () => {
    it('rejects unknown source literal', () => {
        expect(() => moderationIncidentDocSchema.parse({
            reason: 'duplicate_spam',
            source: 'email', // invalid
            createdAt: ts,
        })).toThrow();
    });
});
//# sourceMappingURL=shared-schemas.test.js.map