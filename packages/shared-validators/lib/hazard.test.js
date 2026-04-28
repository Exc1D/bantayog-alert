import { describe, it, expect } from 'vitest';
import { CAMARINES_NORTE_MUNICIPALITIES } from './municipalities';
import { hazardZoneDocSchema, hazardSignalDocSchema, hazardZoneHistoryDocSchema } from './hazard';
describe('Hazard Schemas', () => {
    describe('hazardZoneDocSchema', () => {
        it('accepts valid reference hazard zone document', () => {
            const validDoc = {
                zoneType: 'reference',
                hazardType: 'flood',
                hazardSeverity: 'high',
                scope: 'municipality',
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
            };
            expect(() => hazardZoneDocSchema.parse(validDoc)).not.toThrow();
        });
        it('accepts valid custom hazard zone document', () => {
            const validDoc = {
                zoneType: 'custom',
                hazardType: 'landslide',
                scope: 'provincial',
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
            };
            expect(() => hazardZoneDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects invalid hazardType literal', () => {
            const invalidDoc = {
                zoneType: 'reference',
                hazardType: 'invalid-hazard',
                scope: 'municipality',
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
            };
            expect(() => hazardZoneDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects invalid geohashPrefix length', () => {
            const invalidDoc = {
                zoneType: 'reference',
                hazardType: 'flood',
                scope: 'municipality',
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
            };
            expect(() => hazardZoneDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                zoneType: 'reference',
                hazardType: 'flood',
                scope: 'municipality',
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
            };
            expect(() => hazardZoneDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
    describe('hazardSignalDocSchema', () => {
        it('accepts valid hazard signal document', () => {
            const validDoc = {
                hazardType: 'tropical_cyclone',
                signalLevel: 5,
                source: 'manual',
                scopeType: 'province',
                affectedMunicipalityIds: CAMARINES_NORTE_MUNICIPALITIES.map((municipality) => municipality.id),
                status: 'active',
                validFrom: 1713350400000,
                validUntil: 1713436800000,
                recordedAt: 1713350400000,
                rawSource: 'manual',
                recordedBy: 'admin-1',
                reason: 'PAGASA radio confirmation',
                schemaVersion: 1,
            };
            expect(() => hazardSignalDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects province scope when municipality set is incomplete', () => {
            const invalidDoc = {
                hazardType: 'tropical_cyclone',
                signalLevel: 3,
                source: 'manual',
                scopeType: 'province',
                affectedMunicipalityIds: CAMARINES_NORTE_MUNICIPALITIES.slice(0, -1).map((municipality) => municipality.id),
                status: 'active',
                validFrom: 1713350400000,
                validUntil: 1713436800000,
                recordedAt: 1713350400000,
                rawSource: 'manual',
                schemaVersion: 1,
            };
            expect(() => hazardSignalDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects invalid source literal', () => {
            const invalidDoc = {
                hazardType: 'tropical_cyclone',
                signalLevel: 3,
                source: 'invalid-source',
                scopeType: 'municipalities',
                affectedMunicipalityIds: ['daet'],
                status: 'active',
                validFrom: 1713350400000,
                validUntil: 1713436800000,
                recordedAt: 1713350400000,
                rawSource: 'manual',
                schemaVersion: 1,
            };
            expect(() => hazardSignalDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects signalLevel outside 1-5 range', () => {
            const invalidDoc = {
                hazardType: 'tropical_cyclone',
                signalLevel: 6, // must be 1-5
                source: 'manual',
                scopeType: 'municipalities',
                affectedMunicipalityIds: ['daet'],
                status: 'active',
                validFrom: 1713350400000,
                validUntil: 1713436800000,
                recordedAt: 1713350400000,
                rawSource: 'manual',
                schemaVersion: 1,
            };
            expect(() => hazardSignalDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                hazardType: 'tropical_cyclone',
                signalLevel: 4,
                source: 'manual',
                scopeType: 'municipalities',
                affectedMunicipalityIds: ['daet'],
                status: 'active',
                validFrom: 1713350400000,
                validUntil: 1713436800000,
                recordedAt: 1713350400000,
                rawSource: 'manual',
                schemaVersion: 1,
                unknownField: 'should not be allowed',
            };
            expect(() => hazardSignalDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
    describe('hazardZoneHistoryDocSchema', () => {
        it('accepts valid hazard zone history document', () => {
            const validDoc = {
                zoneType: 'reference',
                hazardType: 'flood',
                scope: 'municipality',
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
            };
            expect(() => hazardZoneHistoryDocSchema.parse(validDoc)).not.toThrow();
        });
        it('rejects missing historyVersion field', () => {
            const invalidDoc = {
                zoneType: 'reference',
                hazardType: 'flood',
                scope: 'municipality',
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
            };
            expect(() => hazardZoneHistoryDocSchema.parse(invalidDoc)).toThrow();
        });
        it('rejects unknown keys via strict mode', () => {
            const docWithExtraKey = {
                zoneType: 'reference',
                hazardType: 'flood',
                scope: 'municipality',
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
            };
            expect(() => hazardZoneHistoryDocSchema.parse(docWithExtraKey)).toThrow();
        });
    });
});
//# sourceMappingURL=hazard.test.js.map