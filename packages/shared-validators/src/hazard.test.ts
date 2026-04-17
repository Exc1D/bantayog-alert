import { describe, it, expect } from 'vitest'
import { hazardZoneDocSchema, hazardSignalDocSchema, hazardZoneHistoryDocSchema } from './hazard'

describe('Hazard Schemas', () => {
  describe('hazardZoneDocSchema', () => {
    it('accepts valid reference hazard zone document', () => {
      const validDoc = {
        zoneType: 'reference' as const,
        hazardType: 'flood' as const,
        hazardSeverity: 'high' as const,
        scope: 'municipality' as const,
        municipalityId: 'daet',
        displayName: 'Flood Prone Area - Barangay X',
        polygonRef: 'poly-12345',
        bbox: {
          minLat: 14.0,
          minLng: 123.0,
          maxLat: 14.1,
          maxLng: 123.1,
        },
        geohashPrefix: 'daet00',
        vertexCount: 100,
        version: 1,
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => hazardZoneDocSchema.parse(validDoc)).not.toThrow()
    })

    it('accepts valid custom hazard zone document', () => {
      const validDoc = {
        zoneType: 'custom' as const,
        hazardType: 'landslide' as const,
        scope: 'provincial' as const,
        displayName: 'Custom Evacuation Zone',
        polygonRef: 'custom-poly-001',
        bbox: {
          minLat: 14.0,
          minLng: 123.0,
          maxLat: 14.1,
          maxLng: 123.1,
        },
        geohashPrefix: 'daet01',
        vertexCount: 50,
        version: 1,
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350400000,
        expiresAt: 1713436800000,
        schemaVersion: 1,
      }
      expect(() => hazardZoneDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects invalid hazardType literal', () => {
      const invalidDoc = {
        zoneType: 'reference' as const,
        hazardType: 'invalid-hazard',
        scope: 'municipality' as const,
        municipalityId: 'daet',
        displayName: 'Test Zone',
        polygonRef: 'poly-001',
        bbox: {
          minLat: 14.0,
          minLng: 123.0,
          maxLat: 14.1,
          maxLng: 123.1,
        },
        geohashPrefix: 'daet00',
        vertexCount: 10,
        version: 1,
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => hazardZoneDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects invalid geohashPrefix length', () => {
      const invalidDoc = {
        zoneType: 'reference' as const,
        hazardType: 'flood' as const,
        scope: 'municipality' as const,
        municipalityId: 'daet',
        displayName: 'Test Zone',
        polygonRef: 'poly-001',
        bbox: {
          minLat: 14.0,
          minLng: 123.0,
          maxLat: 14.1,
          maxLng: 123.1,
        },
        geohashPrefix: 'daet0', // must be exactly 6 chars
        vertexCount: 10,
        version: 1,
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => hazardZoneDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        zoneType: 'reference' as const,
        hazardType: 'flood' as const,
        scope: 'municipality' as const,
        municipalityId: 'daet',
        displayName: 'Test Zone',
        polygonRef: 'poly-001',
        bbox: {
          minLat: 14.0,
          minLng: 123.0,
          maxLat: 14.1,
          maxLng: 123.1,
        },
        geohashPrefix: 'daet00',
        vertexCount: 10,
        version: 1,
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350400000,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => hazardZoneDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('hazardSignalDocSchema', () => {
    it('accepts valid hazard signal document', () => {
      const validDoc = {
        source: 'pagasa_webhook' as const,
        signalLevel: 5,
        affectedMunicipalityIds: ['daet', 'vinzons'],
        createdAt: 1713350400000,
        createdBy: 'admin-1',
        expiresAt: 1713436800000,
        schemaVersion: 1,
      }
      expect(() => hazardSignalDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects invalid source literal', () => {
      const invalidDoc = {
        source: 'invalid-source',
        signalLevel: 3,
        affectedMunicipalityIds: ['daet'],
        createdAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => hazardSignalDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects signalLevel outside 0-5 range', () => {
      const invalidDoc = {
        source: 'pagasa_webhook' as const,
        signalLevel: 6, // must be 0-5
        affectedMunicipalityIds: ['daet'],
        createdAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => hazardSignalDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        source: 'pagasa_webhook' as const,
        signalLevel: 4,
        affectedMunicipalityIds: ['daet'],
        createdAt: 1713350400000,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => hazardSignalDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })

  describe('hazardZoneHistoryDocSchema', () => {
    it('accepts valid hazard zone history document', () => {
      const validDoc = {
        zoneType: 'reference' as const,
        hazardType: 'flood' as const,
        scope: 'municipality' as const,
        municipalityId: 'daet',
        displayName: 'Flood Zone - History',
        polygonRef: 'poly-12345',
        bbox: {
          minLat: 14.0,
          minLng: 123.0,
          maxLat: 14.1,
          maxLng: 123.1,
        },
        geohashPrefix: 'daet00',
        vertexCount: 100,
        version: 1,
        historyVersion: 1,
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => hazardZoneHistoryDocSchema.parse(validDoc)).not.toThrow()
    })

    it('rejects missing historyVersion field', () => {
      const invalidDoc = {
        zoneType: 'reference' as const,
        hazardType: 'flood' as const,
        scope: 'municipality' as const,
        municipalityId: 'daet',
        displayName: 'Test Zone',
        polygonRef: 'poly-001',
        bbox: {
          minLat: 14.0,
          minLng: 123.0,
          maxLat: 14.1,
          maxLng: 123.1,
        },
        geohashPrefix: 'daet00',
        vertexCount: 10,
        version: 1,
        // missing historyVersion
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350400000,
        schemaVersion: 1,
      }
      expect(() => hazardZoneHistoryDocSchema.parse(invalidDoc)).toThrow()
    })

    it('rejects unknown keys via strict mode', () => {
      const docWithExtraKey = {
        zoneType: 'reference' as const,
        hazardType: 'flood' as const,
        scope: 'municipality' as const,
        municipalityId: 'daet',
        displayName: 'Test Zone',
        polygonRef: 'poly-001',
        bbox: {
          minLat: 14.0,
          minLng: 123.0,
          maxLat: 14.1,
          maxLng: 123.1,
        },
        geohashPrefix: 'daet00',
        vertexCount: 10,
        version: 1,
        historyVersion: 1,
        createdBy: 'admin-1',
        createdAt: 1713350400000,
        updatedAt: 1713350400000,
        schemaVersion: 1,
        unknownField: 'should not be allowed',
      }
      expect(() => hazardZoneHistoryDocSchema.parse(docWithExtraKey)).toThrow()
    })
  })
})
