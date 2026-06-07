import { describe, expect, it } from 'vitest';
import { auditEventSchema, commandEnvelopeSchema, commandRouteParamsSchema, duplicateClusterQuerySchema, incidentLifecycleRecordSchema, incidentCoreSchema, incidentLocationSchema, opsAppSurfaceSchema, postgisStoreReferenceSchema, publicIncidentBBoxQuerySchema, publicIncidentCardSchema, publicIncidentProjectionEventSchema, responderNearbyQuerySchema, reporterPrivacyRecordSchema, } from './incident-core.js';
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
describe('incidentLifecycleRecordSchema', () => {
    it('requires every lifecycle child record to hang off an incident', () => {
        const childKinds = [
            'report',
            'verification',
            'public_visibility',
            'dispatch',
            'responder_status',
            'alert',
            'audit',
            'privacy',
        ];
        for (const recordKind of childKinds) {
            expect(incidentLifecycleRecordSchema.parse({
                incidentId: 'incident-1',
                reportId: 'report-1',
                recordKind,
                recordId: `${recordKind}-1`,
                createdAt: ts,
                schemaVersion: 1,
            })).toMatchObject({ incidentId: 'incident-1', recordKind });
        }
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
    it('names the PostGIS-backed tables for spatial records', () => {
        expect(postgisStoreReferenceSchema.parse({
            table: 'municipal_boundaries',
            primaryKey: 'daet',
            geometryColumn: 'geom',
            srid: 4326,
            index: 'gist',
            schemaVersion: 1,
        })).toMatchObject({ table: 'municipal_boundaries', srid: 4326 });
    });
    it('accepts a point-backed table with geometryColumn point', () => {
        expect(postgisStoreReferenceSchema.parse({
            table: 'incident_locations',
            primaryKey: 'incident-1',
            geometryColumn: 'point',
            srid: 4326,
            index: 'gist',
            schemaVersion: 1,
        })).toMatchObject({ table: 'incident_locations', geometryColumn: 'point' });
    });
    it('rejects unsupported index methods', () => {
        expect(() => postgisStoreReferenceSchema.parse({
            table: 'municipal_boundaries',
            primaryKey: 'daet',
            geometryColumn: 'geom',
            srid: 4326,
            index: 'spgist',
            schemaVersion: 1,
        })).toThrow(/Invalid input/);
    });
    it('accepts duplicate clustering query inputs in meters', () => {
        expect(duplicateClusterQuerySchema.parse({
            incidentId: 'incident-1',
            point: { lng: 122.95, lat: 14.11 },
            radiusMeters: 750,
            minPoints: 2,
            since: ts,
        })).toMatchObject({ radiusMeters: 750, minPoints: 2 });
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
    it('accepts grouped command route params for the Cloud Run API', () => {
        expect(commandRouteParamsSchema.parse({
            group: 'incidents',
            action: 'publish',
        })).toMatchObject({ group: 'incidents', action: 'publish' });
    });
});
describe('opsAppSurfaceSchema', () => {
    it('keeps admin and responder experiences in one role-aware ops app', () => {
        const adminSurface = opsAppSurfaceSchema.parse({
            app: 'ops',
            layout: 'desktop_command',
            audience: 'admin',
            role: 'municipal_admin',
            capabilities: ['incidents', 'dispatches', 'alerts', 'map'],
            schemaVersion: 1,
        });
        const responderSurface = opsAppSurfaceSchema.parse({
            app: 'ops',
            layout: 'field',
            audience: 'responder',
            role: 'responder',
            capabilities: ['incidents', 'dispatches', 'profile', 'responder_status'],
            schemaVersion: 1,
        });
        expect(adminSurface.app).toBe(responderSurface.app);
    });
    it('rejects audience and role mismatches between ops layouts', () => {
        expect(() => opsAppSurfaceSchema.parse({
            app: 'ops',
            layout: 'field',
            audience: 'admin',
            role: 'responder',
            capabilities: ['incidents'],
            schemaVersion: 1,
        })).toThrow(/admin ops surfaces cannot use responder roles/);
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
    it('models public map/feed changes as projection events', () => {
        expect(publicIncidentProjectionEventSchema.parse({
            incidentId: 'incident-1',
            action: 'publish',
            card: {
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
            },
            occurredAt: ts,
            schemaVersion: 1,
        })).toMatchObject({ action: 'publish' });
        expect(publicIncidentProjectionEventSchema.parse({
            incidentId: 'incident-1',
            action: 'unpublish',
            occurredAt: ts,
            schemaVersion: 1,
        })).toMatchObject({ action: 'unpublish' });
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