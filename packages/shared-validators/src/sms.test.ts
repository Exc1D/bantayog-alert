import { describe, it, expect } from 'vitest'
import {
  smsInboxDocSchema,
  smsOutboxDocSchema,
  smsSessionDocSchema,
  smsProviderHealthDocSchema,
} from './sms'

describe('SMS Schemas', () => {
  describe('smsInboxDocSchema', () => {
    it('accepts valid sms inbox document', () => {
      const validDoc = {
        providerId: 'semaphore' as const,
        receivedAt: 1713350400000,
        senderMsisdnHash: 'a'.repeat(64),
        body: 'Test message',
        parseStatus: 'parsed' as const,
        parsedIntoInboxId: 'inbox-123',
        confidenceScore: 0.95,
        schemaVersion: 1,
      }
      expect(() => smsInboxDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects invalid providerId literal', () => {
      const invalidDoc = {
        providerId: 'invalid-provider', // not 'semaphore' | 'globelabs'
        receivedAt: 1713350400000,
        senderMsisdnHash: 'a'.repeat(64),
        body: 'Test message',
        parseStatus: 'parsed' as const,
        schemaVersion: 1,
      }
      expect(() => smsInboxDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects missing required fields', () => {
      const incompleteDoc = {
        providerId: 'semaphore' as const,
        // missing senderMsisdnHash, body, etc.
        receivedAt: 1713350400000,
        parseStatus: 'parsed' as const,
        schemaVersion: 1,
      }
      expect(() => smsInboxDocSchema.parse(incompleteDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        providerId: 'semaphore' as const,
        receivedAt: 1713350400000,
        senderMsisdnHash: 'a'.repeat(64),
        body: 'Test message',
        parseStatus: 'parsed' as const,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => smsInboxDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('smsOutboxDocSchema', () => {
    it('accepts valid sms outbox document', () => {
      const validDoc = {
        providerId: 'semaphore' as const,
        recipientMsisdnHash: 'b'.repeat(64),
        purpose: 'receipt_ack' as const,
        encoding: 'GSM-7' as const,
        segmentCount: 1,
        bodyPreviewHash: 'c'.repeat(64),
        status: 'queued' as const,
        idempotencyKey: 'key-12345',
        createdAt: 1713350400000,
        sentAt: 1713350401000,
        providerMessageId: 'sent-12345',
        schemaVersion: 1,
      }
      expect(() => smsOutboxDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects invalid status literal', () => {
      const invalidDoc = {
        providerId: 'semaphore' as const,
        recipientMsisdnHash: 'b'.repeat(64),
        purpose: 'receipt_ack' as const,
        encoding: 'GSM-7' as const,
        segmentCount: 1,
        bodyPreviewHash: 'c'.repeat(64),
        status: 'invalid-status', // not in union
        idempotencyKey: 'key-12345',
        createdAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => smsOutboxDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        providerId: 'semaphore' as const,
        recipientMsisdnHash: 'b'.repeat(64),
        purpose: 'receipt_ack' as const,
        encoding: 'GSM-7' as const,
        segmentCount: 1,
        bodyPreviewHash: 'c'.repeat(64),
        status: 'queued' as const,
        idempotencyKey: 'key-12345',
        createdAt: 1713350400000,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => smsOutboxDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('smsSessionDocSchema', () => {
    it('accepts valid sms session document', () => {
      const validDoc = {
        msisdnHash: 'd'.repeat(64),
        lastReceivedAt: 1713350400000,
        rateLimitCount: 0,
        updatedAt: 1713350400000,
      }
      expect(() => smsSessionDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects negative rateLimitCount', () => {
      const invalidDoc = {
        msisdnHash: 'd'.repeat(64),
        lastReceivedAt: 1713350400000,
        rateLimitCount: -1, // must be non-negative
        updatedAt: 1713350400000,
      }
      expect(() => smsSessionDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        msisdnHash: 'd'.repeat(64),
        lastReceivedAt: 1713350400000,
        rateLimitCount: 0,
        updatedAt: 1713350400000,
        unknownField: 'should not be allowed',
      }
      expect(() => smsSessionDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('smsProviderHealthDocSchema', () => {
    it('accepts valid provider health document', () => {
      const validDoc = {
        providerId: 'semaphore' as const,
        circuitState: 'closed' as const,
        errorRatePct: 5.5,
        updatedAt: 1713350400000,
      }
      expect(() => smsProviderHealthDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects invalid circuitState literal', () => {
      const invalidDoc = {
        providerId: 'semaphore' as const,
        circuitState: 'invalid-state',
        errorRatePct: 5.5,
        updatedAt: 1713350400000,
      }
      expect(() => smsProviderHealthDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects errorRatePct outside 0-100 range', () => {
      const invalidDoc = {
        providerId: 'semaphore' as const,
        circuitState: 'closed' as const,
        errorRatePct: 150, // must be 0-100
        updatedAt: 1713350400000,
      }
      expect(() => smsProviderHealthDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        providerId: 'semaphore' as const,
        circuitState: 'closed' as const,
        errorRatePct: 5.5,
        updatedAt: 1713350400000,
        unknownField: 'should not be allowed',
      }
      expect(() => smsProviderHealthDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })
})
