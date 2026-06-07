import { z } from 'zod'

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
])

const severitySchema = z.enum(['low', 'medium', 'high'])
const incidentSourceSchema = z.enum(['web', 'responder_witness', 'official'])

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
])

export const verificationStatusSchema = z.enum([
  'unverified',
  'awaiting_review',
  'verified',
  'rejected',
])

export const publicationStatusSchema = z.enum(['internal', 'public'])

export const postgisPointSchema = z
  .object({
    lng: z.number().min(-180).max(180),
    lat: z.number().min(-90).max(90),
  })
  .strict()

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
  .strict()

export const incidentLocationSchema = z
  .object({
    incidentId: z.string().min(1),
    point: postgisPointSchema,
    accuracyMeters: z.number().nonnegative().optional(),
    source: z.enum(['gps', 'manual', 'geocoder', 'responder_telemetry']),
    recordedAt: z.number().int().nonnegative(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

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
  })

export const responderNearbyQuerySchema = z
  .object({
    incidentId: z.string().min(1),
    point: postgisPointSchema,
    radiusMeters: z.number().int().min(1).max(100000),
    limit: z.number().int().min(1).max(50).default(10),
  })
  .strict()

export const commandEnvelopeSchema = z
  .object({
    group: z.enum(['reports', 'incidents', 'dispatches', 'alerts', 'users', 'privacy', 'ops']),
    action: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-zA-Z0-9]*$/),
    idempotencyKey: z.string().min(1).max(128),
    actorUid: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict()

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
  .strict()

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
  .strict()

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
  .strict()

export type OperationalStatus = z.infer<typeof operationalStatusSchema>
export type VerificationStatus = z.infer<typeof verificationStatusSchema>
export type PublicationStatus = z.infer<typeof publicationStatusSchema>
export type PostgisPoint = z.infer<typeof postgisPointSchema>
export type IncidentCore = z.infer<typeof incidentCoreSchema>
export type IncidentLocation = z.infer<typeof incidentLocationSchema>
export type PublicIncidentBBoxQuery = z.infer<typeof publicIncidentBBoxQuerySchema>
export type ResponderNearbyQuery = z.infer<typeof responderNearbyQuerySchema>
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>
export type PublicIncidentCard = z.infer<typeof publicIncidentCardSchema>
export type AuditEvent = z.infer<typeof auditEventSchema>
export type ReporterPrivacyRecord = z.infer<typeof reporterPrivacyRecordSchema>
