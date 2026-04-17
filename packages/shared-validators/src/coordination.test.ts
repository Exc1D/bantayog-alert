import { describe, it, expect } from 'vitest'
import {
  shiftHandoffDocSchema,
  massAlertRequestDocSchema,
  commandChannelThreadDocSchema,
  commandChannelMessageDocSchema,
  agencyAssistanceRequestDocSchema,
} from './coordination'

describe('Coordination Schemas', () => {
  describe('shiftHandoffDocSchema', () => {
    it('accepts valid shift handoff document', () => {
      const validDoc = {
        fromUid: 'responder-1',
        toUid: 'responder-2',
        municipalityId: 'daet',
        activeIncidentSnapshot: ['incident-1', 'incident-2'],
        notes: 'Shift change normal',
        status: 'pending' as const,
        createdAt: 1713350400000,
        acceptedAt: 1713350401000,
        expiresAt: 1713436800000,
        schemaVersion: 1,
      }
      expect(() => shiftHandoffDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects invalid status literal', () => {
      const invalidDoc = {
        fromUid: 'responder-1',
        toUid: 'responder-2',
        municipalityId: 'daet',
        activeIncidentSnapshot: [],
        notes: 'Test',
        status: 'invalid-status',
        createdAt: 1713350400000,
        expiresAt: 1713436800000,
        schemaVersion: 1,
      }
      expect(() => shiftHandoffDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        fromUid: 'responder-1',
        toUid: 'responder-2',
        municipalityId: 'daet',
        activeIncidentSnapshot: [],
        notes: 'Test',
        status: 'pending' as const,
        createdAt: 1713350400000,
        expiresAt: 1713436800000,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => shiftHandoffDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('massAlertRequestDocSchema', () => {
    it('accepts valid mass alert request document', () => {
      const validDoc = {
        requestedByMunicipality: 'Daet',
        requestedByUid: 'admin-1',
        severity: 'high' as const,
        body: 'Evacuation alert for Barangay X',
        targetType: 'municipality' as const,
        estimatedReach: 5000,
        status: 'queued' as const,
        createdAt: 1713350400000,
        forwardedAt: 1713350401000,
        schemaVersion: 1,
      }
      expect(() => massAlertRequestDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects invalid severity literal', () => {
      const invalidDoc = {
        requestedByMunicipality: 'Daet',
        requestedByUid: 'admin-1',
        severity: 'invalid-severity',
        body: 'Test',
        targetType: 'municipality' as const,
        estimatedReach: 100,
        status: 'queued' as const,
        createdAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => massAlertRequestDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        requestedByMunicipality: 'Daet',
        requestedByUid: 'admin-1',
        severity: 'high' as const,
        body: 'Test',
        targetType: 'municipality' as const,
        estimatedReach: 100,
        status: 'queued' as const,
        createdAt: 1713350400000,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => massAlertRequestDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('commandChannelThreadDocSchema', () => {
    it('accepts valid command channel thread document', () => {
      const validDoc = {
        threadId: 'thread-123',
        subject: 'Emergency response coordination',
        participantUids: { 'admin-1': true, 'responder-1': true },
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350401000,
        schemaVersion: 1,
      }
      expect(() => commandChannelThreadDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects missing required fields', () => {
      const incompleteDoc = {
        threadId: 'thread-123',
        // missing subject, participantUids, createdBy
        createdAt: 1713350400000,
        updatedAt: 1713350401000,
        schemaVersion: 1,
      }
      expect(() => commandChannelThreadDocSchema.parse(incompleteDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        threadId: 'thread-123',
        subject: 'Test',
        participantUids: {},
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350401000,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => commandChannelThreadDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('commandChannelMessageDocSchema', () => {
    it('accepts valid command channel message document', () => {
      const validDoc = {
        threadId: 'thread-123',
        authorUid: 'admin-1',
        authorRole: 'municipal_admin' as const,
        body: 'Proceed to location immediately',
        createdAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => commandChannelMessageDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects invalid authorRole literal', () => {
      const invalidDoc = {
        threadId: 'thread-123',
        authorUid: 'admin-1',
        authorRole: 'invalid-role',
        body: 'Test',
        createdAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => commandChannelMessageDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects body longer than 2000 characters', () => {
      const invalidDoc = {
        threadId: 'thread-123',
        authorUid: 'admin-1',
        authorRole: 'municipal_admin' as const,
        body: 'a'.repeat(2001), // exceeds max(2000)
        createdAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => commandChannelMessageDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        threadId: 'thread-123',
        authorUid: 'admin-1',
        authorRole: 'municipal_admin' as const,
        body: 'Test',
        createdAt: 1713350400000,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => commandChannelMessageDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('agencyAssistanceRequestDocSchema', () => {
    it('accepts valid agency assistance request document', () => {
      const validDoc = {
        reportId: 'report-123',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP' as const,
        message: 'Requesting assistance for flood response',
        priority: 'urgent' as const,
        status: 'pending' as const,
        fulfilledByDispatchIds: [],
        createdAt: 1713350400000,
        expiresAt: 1713436800000,
      }
      expect(() => agencyAssistanceRequestDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects when expiresAt is not after createdAt', () => {
      const invalidDoc = {
        reportId: 'report-123',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP' as const,
        message: 'Test',
        priority: 'normal' as const,
        status: 'pending' as const,
        fulfilledByDispatchIds: [],
        createdAt: 1713350400000,
        expiresAt: 1713350399999, // before createdAt
      }
      expect(() => agencyAssistanceRequestDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        reportId: 'report-123',
        requestedByMunicipalId: 'daet',
        requestedByMunicipality: 'Daet',
        targetAgencyId: 'bfp',
        requestType: 'BFP' as const,
        message: 'Test',
        priority: 'normal' as const,
        status: 'pending' as const,
        fulfilledByDispatchIds: [],
        createdAt: 1713350400000,
        expiresAt: 1713436800000,
        unknownField: 'should not be allowed',
      }
      expect(() => agencyAssistanceRequestDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })
})
