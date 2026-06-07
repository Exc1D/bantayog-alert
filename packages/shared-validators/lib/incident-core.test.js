import { describe, expect, it } from 'vitest';
import { auditEventSchema, commandEnvelopeSchema, incidentCoreSchema, incidentLocationSchema, publicIncidentBBoxQuerySchema, publicIncidentCardSchema, responderNearbyQuerySchema, reporterPrivacyRecordSchema, } from './incident-core.js';
const ts = 1713350400000;
describe('incidentCoreSchema', () => {
    it('keeps operational, verification, and publication lifecycle axes separate', () => {
        expect(incidentCoreSchema.parse({
            id: 'incident-1',
            reportType: 'flood',
            severity: 'high',
            operationalStatus: 'resolved',
            verificationStatus: 'verified',
            publicationStatus: 'public',
            municipalityId: 'daet',
            municipalityLabel: 'Daet',
            barangayId: 'calasgasan',
            source: 'web',
            createdAt: ts,
            updatedAt: ts,
            schemaVersion: 1,
        })).toMatchObject({
            operationalStatus: 'resolved',
            verificationStatus: 'verified',
            publicationStatus: 'public',
        });
    });
});
describe('incident geospatial schemas', () => {
    it('accepts PostGIS-ready longitude/latitude point input', () => {
        expect(incidentLocationSchema.parse({
            incidentId: 'incident-1',
            point: { lng: 122.95, lat: 14.11 },
            accuracyMeters: 20,
            source: 'gps',
            recordedAt: ts,
            schemaVersion: 1,
        })).toMatchObject({ point: { lng: 122.95, lat: 14.11 } });
    });
    it('rejects invalid public bbox bounds', () => {
        expect(() => publicIncidentBBoxQuerySchema.parse({
            minLng: 123,
            minLat: 14,
            maxLng: 122,
            maxLat: 15,
        })).toThrow(/minLng/);
    });
    it('accepts nearby responder query inputs in meters', () => {
        expect(responderNearbyQuerySchema.parse({
            incidentId: 'incident-1',
            point: { lng: 122.95, lat: 14.11 },
            radiusMeters: 5000,
            limit: 10,
        })).toMatchObject({ radiusMeters: 5000 });
    });
});
describe('commandEnvelopeSchema', () => {
    it('accepts grouped command API envelope names', () => {
        expect(commandEnvelopeSchema.parse({
            group: 'dispatches',
            action: 'assignResponder',
            idempotencyKey: 'idem-1',
            actorUid: 'admin-1',
            payload: { incidentId: 'incident-1', responderUid: 'responder-1' },
        })).toMatchObject({ group: 'dispatches', action: 'assignResponder' });
    });
});
describe('publicIncidentCardSchema', () => {
    it('accepts a sanitized citizen map/feed read model', () => {
        expect(publicIncidentCardSchema.parse({
            incidentId: 'incident-1',
            reportType: 'flood',
            severity: 'high',
            operationalStatus: 'resolved',
            municipalityId: 'daet',
            municipalityLabel: 'Daet',
            barangayId: 'calasgasan',
            publicSummary: 'Floodwater has receded near the market.',
            point: { lng: 122.95, lat: 14.11 },
            publishedAt: ts,
            updatedAt: ts,
            schemaVersion: 1,
        })).toMatchObject({ incidentId: 'incident-1' });
    });
    it('rejects private reporter fields in the public read model', () => {
        const result = publicIncidentCardSchema.safeParse({
            incidentId: 'incident-1',
            reportType: 'flood',
            severity: 'high',
            operationalStatus: 'resolved',
            municipalityId: 'daet',
            municipalityLabel: 'Daet',
            barangayId: 'calasgasan',
            publicSummary: 'Floodwater near the market.',
            point: { lng: 122.95, lat: 14.11 },
            publishedAt: ts,
            updatedAt: ts,
            schemaVersion: 1,
            reporterName: 'Maria Private',
            reporterPhone: '+639171234567',
        });
        expect(result.success).toBe(false);
        const issues = result.success ? [] : result.error.issues;
        expect(issues.some((issue) => issue.code === 'invalid_value')).toBe(false);
        expect(issues).toContainEqual(expect.objectContaining({
            code: 'unrecognized_keys',
            keys: expect.arrayContaining(['reporterName', 'reporterPhone']),
        }));
    });
});
describe('audit and privacy schemas', () => {
    it('accepts append-only audit event records', () => {
        expect(auditEventSchema.parse({
            id: 'audit-1',
            incidentId: 'incident-1',
            actorUid: 'admin-1',
            action: 'incidents.publish',
            at: ts,
            metadata: { publicationStatus: 'public' },
            schemaVersion: 1,
        })).toMatchObject({ action: 'incidents.publish' });
    });
    it('keeps reporter identity in a private privacy record', () => {
        expect(reporterPrivacyRecordSchema.parse({
            incidentId: 'incident-1',
            reporterUid: 'citizen-1',
            reporterPhoneHash: 'a'.repeat(64),
            retentionState: 'active',
            createdAt: ts,
            updatedAt: ts,
            schemaVersion: 1,
        })).toMatchObject({ retentionState: 'active' });
    });
});
//# sourceMappingURL=incident-core.test.js.map