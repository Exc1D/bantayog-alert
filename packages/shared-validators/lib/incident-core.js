import { z } from 'zod';
const reportTypeSchema = z.enum([
    'flood',
    'fire',
    'earthquake',
    'typhoon',
    'landslide',
    'storm_surge',
    'medical',
    'accident',
    'structural',
    'security',
    'other',
]);
const severitySchema = z.enum(['low', 'medium', 'high']);
const incidentSourceSchema = z.enum(['web', 'responder_witness', 'official']);
const commandGroupSchema = z.enum(['reports', 'incidents', 'dispatches', 'alerts', 'users', 'privacy', 'ops']);
const commandActionSchema = z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-zA-Z0-9]*$/);
export const operationalStatusSchema = z.enum([
    'intake',
    'triage',
    'ready_for_dispatch',
    'assigned',
    'acknowledged',
    'en_route',
    'on_scene',
    'resolved',
    'closed',
    'cancelled',
    'merged_as_duplicate',
]);
export const verificationStatusSchema = z.enum([
    'unverified',
    'awaiting_review',
    'verified',
    'rejected',
]);
export const publicationStatusSchema = z.enum(['internal', 'public']);
export const postgisPointSchema = z
    .object({
    lng: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
})
    .strict();
export const incidentCoreSchema = z
    .object({
    id: z.string().min(1),
    reportType: reportTypeSchema,
    severity: severitySchema,
    operationalStatus: operationalStatusSchema,
    verificationStatus: verificationStatusSchema,
    publicationStatus: publicationStatusSchema,
    municipalityId: z.string().min(1),
    municipalityLabel: z.string().min(1).max(64),
    barangayId: z.string().min(1),
    source: incidentSourceSchema,
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const incidentLifecycleRecordSchema = z
    .object({
    incidentId: z.string().min(1),
    reportId: z.string().min(1).optional(),
    recordKind: z.enum([
        'report',
        'verification',
        'public_visibility',
        'dispatch',
        'responder_status',
        'alert',
        'audit',
        'privacy',
    ]),
    recordId: z.string().min(1),
    createdAt: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const incidentLocationSchema = z
    .object({
    incidentId: z.string().min(1),
    point: postgisPointSchema,
    accuracyMeters: z.number().nonnegative().optional(),
    source: z.enum(['gps', 'manual', 'geocoder', 'responder_telemetry']),
    recordedAt: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const postgisStoreReferenceSchema = z
    .object({
    table: z.enum([
        'incident_locations',
        'responder_locations',
        'municipal_boundaries',
        'alert_areas',
        'duplicate_cluster_inputs',
        'public_incident_cards',
    ]),
    primaryKey: z.string().min(1),
    geometryColumn: z.enum(['geom', 'geog', 'centroid']).default('geom'),
    srid: z.literal(4326),
    index: z.enum(['gist', 'spgist']),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const publicIncidentBBoxQuerySchema = z
    .object({
    minLng: z.number().min(-180).max(180),
    minLat: z.number().min(-90).max(90),
    maxLng: z.number().min(-180).max(180),
    maxLat: z.number().min(-90).max(90),
    since: z.number().int().nonnegative().optional(),
    limit: z.number().int().min(1).max(500).default(100),
})
    .strict()
    .refine((value) => value.minLng < value.maxLng, {
    path: ['minLng'],
    message: 'minLng must be less than maxLng',
})
    .refine((value) => value.minLat < value.maxLat, {
    path: ['minLat'],
    message: 'minLat must be less than maxLat',
});
export const responderNearbyQuerySchema = z
    .object({
    incidentId: z.string().min(1),
    point: postgisPointSchema,
    radiusMeters: z.number().int().min(1).max(100000),
    limit: z.number().int().min(1).max(50).default(10),
})
    .strict();
export const duplicateClusterQuerySchema = z
    .object({
    incidentId: z.string().min(1),
    point: postgisPointSchema,
    radiusMeters: z.number().int().min(1).max(50000),
    minPoints: z.number().int().min(2).max(50),
    since: z.number().int().nonnegative().optional(),
})
    .strict();
export const commandRouteParamsSchema = z
    .object({
    group: commandGroupSchema,
    action: commandActionSchema,
})
    .strict();
export const commandEnvelopeSchema = z
    .object({
    group: commandGroupSchema,
    action: commandActionSchema,
    idempotencyKey: z.string().min(1).max(128),
    actorUid: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
})
    .strict();
export const opsAppSurfaceSchema = z
    .object({
    app: z.literal('ops'),
    layout: z.enum(['desktop_command', 'field']),
    audience: z.enum(['admin', 'responder']),
    role: z.enum(['municipal_admin', 'agency_admin', 'dispatcher', 'responder']),
    capabilities: z
        .array(z.enum(['incidents', 'dispatches', 'alerts', 'feed', 'map', 'profile', 'responder_status']))
        .min(1),
    schemaVersion: z.number().int().positive(),
})
    .strict()
    .superRefine((surface, ctx) => {
    if (surface.audience === 'admin' && surface.role === 'responder') {
        ctx.addIssue({
            code: 'custom',
            path: ['role'],
            message: 'admin ops surfaces cannot use responder roles',
        });
    }
    if (surface.audience === 'responder' && surface.role !== 'responder') {
        ctx.addIssue({
            code: 'custom',
            path: ['role'],
            message: 'responder ops surfaces must use the responder role',
        });
    }
    if (surface.audience === 'admin' && surface.layout !== 'desktop_command') {
        ctx.addIssue({
            code: 'custom',
            path: ['layout'],
            message: 'admin ops surfaces must use the desktop command layout',
        });
    }
    if (surface.audience === 'responder' && surface.layout !== 'field') {
        ctx.addIssue({
            code: 'custom',
            path: ['layout'],
            message: 'responder ops surfaces must use the field layout',
        });
    }
});
export const publicIncidentCardSchema = z
    .object({
    incidentId: z.string().min(1),
    reportType: reportTypeSchema,
    severity: severitySchema,
    operationalStatus: operationalStatusSchema,
    municipalityId: z.string().min(1),
    municipalityLabel: z.string().min(1).max(64),
    barangayId: z.string().min(1),
    publicSummary: z.string().min(1).max(2000),
    point: postgisPointSchema,
    publishedAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
const publicIncidentProjectionBaseSchema = z.object({
    incidentId: z.string().min(1),
    occurredAt: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
});
export const publicIncidentProjectionEventSchema = z.discriminatedUnion('action', [
    publicIncidentProjectionBaseSchema
        .extend({
        action: z.literal('publish'),
        card: publicIncidentCardSchema,
    })
        .strict(),
    publicIncidentProjectionBaseSchema
        .extend({
        action: z.literal('refresh'),
        card: publicIncidentCardSchema,
    })
        .strict(),
    publicIncidentProjectionBaseSchema
        .extend({
        action: z.literal('unpublish'),
    })
        .strict(),
]);
export const auditEventSchema = z
    .object({
    id: z.string().min(1),
    incidentId: z.string().min(1),
    actorUid: z.string().min(1),
    action: z.string().min(1).max(120),
    at: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const reporterPrivacyRecordSchema = z
    .object({
    incidentId: z.string().min(1),
    reporterUid: z.string().min(1),
    reporterPhoneHash: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    retentionState: z.enum(['active', 'erasure_requested', 'legal_hold', 'erased']),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
//# sourceMappingURL=incident-core.js.map