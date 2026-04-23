import { describe, it, expect } from 'vitest';
import { smsInboxDocSchema, smsOutboxDocSchema, smsSessionDocSchema, smsProviderHealthDocSchema, smsMinuteWindowDocSchema, } from './sms';
describe('SMS Schemas', () => {
    describe('smsInboxDocSchema', () => {
        it('accepts valid sms inbox document', () => {
            const validDoc = {
                providerId: 'semaphore',
                receivedAt: 1713350400000,
                senderMsisdnHash: 'a'.repeat(64),
                body: 'Test message',
                parseStatus: 'parsed',
                parsedIntoInboxId: 'inbox-123',
                confidenceScore: 0.95,
                schemaVersion: 1,
            };
            expect(() => smsInboxDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects invalid providerId literal', () => {
            const invalidDoc = {
                providerId: 'invalid-provider', // not 'semaphore' | 'globelabs'
                receivedAt: 1713350400000,
                senderMsisdnHash: 'a'.repeat(64),
                body: 'Test message',
                parseStatus: 'parsed',
                schemaVersion: 1,
            };
            expect(() => smsInboxDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects missing required fields', () => {
            const incompleteDoc = {
                providerId: 'semaphore',
                // missing senderMsisdnHash, body, etc.
                receivedAt: 1713350400000,
                parseStatus: 'parsed',
                schemaVersion: 1,
            };
            expect(() => smsInboxDocSchema.parse(incompleteDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                providerId: 'semaphore',
                receivedAt: 1713350400000,
                senderMsisdnHash: 'a'.repeat(64),
                body: 'Test message',
                parseStatus: 'parsed',
                schemaVersion: 1,
                unknownField: 'should not be allowed',
            };
            expect(() => smsInboxDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
    describe('smsOutboxDocSchema', () => {
        it('accepts valid sms outbox document (v2)', () => {
            const validDoc = {
                providerId: 'semaphore',
                recipientMsisdnHash: 'b'.repeat(64),
                recipientMsisdn: '+639171234567',
                purpose: 'receipt_ack',
                predictedEncoding: 'GSM-7',
                predictedSegmentCount: 1,
                bodyPreviewHash: 'c'.repeat(64),
                status: 'queued',
                idempotencyKey: 'key-12345',
                retryCount: 0,
                locale: 'en',
                createdAt: 1713350400000,
                queuedAt: 1713350400000,
                schemaVersion: 2,
            };
            expect(() => smsOutboxDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects invalid status literal', () => {
            const invalidDoc = {
                providerId: 'semaphore',
                recipientMsisdnHash: 'b'.repeat(64),
                recipientMsisdn: '+639171234567',
                purpose: 'receipt_ack',
                predictedEncoding: 'GSM-7',
                predictedSegmentCount: 1,
                bodyPreviewHash: 'c'.repeat(64),
                status: 'invalid-status', // not in union
                idempotencyKey: 'key-12345',
                retryCount: 0,
                locale: 'en',
                createdAt: 1713350400000,
                queuedAt: 1713350400000,
                schemaVersion: 2,
            };
            expect(() => smsOutboxDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                providerId: 'semaphore',
                recipientMsisdnHash: 'b'.repeat(64),
                recipientMsisdn: '+639171234567',
                purpose: 'receipt_ack',
                predictedEncoding: 'GSM-7',
                predictedSegmentCount: 1,
                bodyPreviewHash: 'c'.repeat(64),
                status: 'queued',
                idempotencyKey: 'key-12345',
                retryCount: 0,
                locale: 'en',
                createdAt: 1713350400000,
                queuedAt: 1713350400000,
                schemaVersion: 2,
                unknownField: 'should not be allowed',
            };
            expect(() => smsOutboxDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
    describe('smsSessionDocSchema', () => {
        it('accepts valid sms session document', () => {
            const validDoc = {
                msisdnHash: 'd'.repeat(64),
                lastReceivedAt: 1713350400000,
                rateLimitCount: 0,
                updatedAt: 1713350400000,
            };
            expect(() => smsSessionDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects negative rateLimitCount', () => {
            const invalidDoc = {
                msisdnHash: 'd'.repeat(64),
                lastReceivedAt: 1713350400000,
                rateLimitCount: -1, // must be non-negative
                updatedAt: 1713350400000,
            };
            expect(() => smsSessionDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                msisdnHash: 'd'.repeat(64),
                lastReceivedAt: 1713350400000,
                rateLimitCount: 0,
                updatedAt: 1713350400000,
                unknownField: 'should not be allowed',
            };
            expect(() => smsSessionDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
    describe('smsProviderHealthDocSchema', () => {
        it('accepts valid provider health document', () => {
            const validDoc = {
                providerId: 'semaphore',
                circuitState: 'closed',
                errorRatePct: 5.5,
                updatedAt: 1713350400000,
            };
            expect(() => smsProviderHealthDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects invalid circuitState literal', () => {
            const invalidDoc = {
                providerId: 'semaphore',
                circuitState: 'invalid-state',
                errorRatePct: 5.5,
                updatedAt: 1713350400000,
            };
            expect(() => smsProviderHealthDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects errorRatePct outside 0-100 range', () => {
            const invalidDoc = {
                providerId: 'semaphore',
                circuitState: 'closed',
                errorRatePct: 150, // must be 0-100
                updatedAt: 1713350400000,
            };
            expect(() => smsProviderHealthDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                providerId: 'semaphore',
                circuitState: 'closed',
                errorRatePct: 5.5,
                updatedAt: 1713350400000,
                unknownField: 'should not be allowed',
            };
            expect(() => smsProviderHealthDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
});
describe('smsOutboxDocSchema v2', () => {
    const baseV2 = {
        providerId: 'semaphore',
        recipientMsisdnHash: 'a'.repeat(64),
        recipientMsisdn: '+639171234567',
        purpose: 'receipt_ack',
        predictedEncoding: 'GSM-7',
        predictedSegmentCount: 1,
        bodyPreviewHash: 'b'.repeat(64),
        status: 'queued',
        idempotencyKey: 'ik-1',
        retryCount: 0,
        locale: 'tl',
        createdAt: 1_700_000_000_000,
        queuedAt: 1_700_000_000_000,
        schemaVersion: 2,
    };
    it('parses a minimal queued doc', () => {
        expect(() => smsOutboxDocSchema.parse(baseV2)).not.toThrow();
    });
    it('allows sending and deferred status values', () => {
        expect(() => smsOutboxDocSchema.parse({ ...baseV2, status: 'sending' })).not.toThrow();
        expect(() => smsOutboxDocSchema.parse({ ...baseV2, status: 'deferred' })).not.toThrow();
    });
    it('rejects the removed undelivered status', () => {
        expect(() => smsOutboxDocSchema.parse({ ...baseV2, status: 'undelivered' })).toThrow();
    });
    it('requires predictedEncoding and predictedSegmentCount', () => {
        const { predictedEncoding, predictedSegmentCount, ...rest } = baseV2;
        expect(predictedEncoding).toBeDefined(); // suppress unused var lint
        expect(predictedSegmentCount).toBeDefined();
        expect(() => smsOutboxDocSchema.parse(rest)).toThrow();
    });
    it('accepts null recipientMsisdn after plaintext clear', () => {
        expect(() => smsOutboxDocSchema.parse({ ...baseV2, recipientMsisdn: null })).not.toThrow();
    });
    it('encoding and segmentCount are optional (set only after provider success)', () => {
        expect(() => smsOutboxDocSchema.parse({ ...baseV2, status: 'sent', encoding: 'GSM-7', segmentCount: 1 })).not.toThrow();
    });
});
describe('smsProviderHealthDocSchema v2', () => {
    const base = {
        providerId: 'semaphore',
        circuitState: 'closed',
        errorRatePct: 0,
        updatedAt: 1_700_000_000_000,
    };
    it('parses a closed-state health doc', () => {
        expect(() => smsProviderHealthDocSchema.parse(base)).not.toThrow();
    });
    it('accepts optional openedAt + lastTransitionReason', () => {
        expect(() => smsProviderHealthDocSchema.parse({
            ...base,
            circuitState: 'open',
            openedAt: 1_700_000_000_000,
            lastTransitionReason: 'error rate 42% over 5 windows',
        })).not.toThrow();
    });
});
describe('smsMinuteWindowDocSchema', () => {
    const base = {
        providerId: 'semaphore',
        windowStartMs: 1_700_000_000_000,
        attempts: 10,
        failures: 2,
        rateLimitedCount: 0,
        latencySumMs: 1500,
        maxLatencyMs: 200,
        updatedAt: 1_700_000_000_000,
        schemaVersion: 1,
    };
    it('parses a minimal minute window', () => {
        expect(() => smsMinuteWindowDocSchema.parse(base)).not.toThrow();
    });
    it('rejects negative counters', () => {
        expect(() => smsMinuteWindowDocSchema.parse({ ...base, attempts: -1 })).toThrow();
    });
    it('rejects schemaVersion other than 1', () => {
        expect(() => smsMinuteWindowDocSchema.parse({ ...base, schemaVersion: 2 })).toThrow();
    });
});
//# sourceMappingURL=sms.test.js.map