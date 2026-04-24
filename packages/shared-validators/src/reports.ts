import { z } from 'zod'
import { msisdnPhSchema } from './msisdn.js'

const reportOpsReportTypeSchema = z.enum([
  'flood',
  'fire',
  'earthquake',
  'typhoon',
  'landslide',
  'storm_surge',
])

// hazard tag schema
export const hazardTagSchema = z
  .object({
    hazardZoneId: z.string().min(1),
    geohash: z.string().length(6),
    hazardType: z.enum(['flood', 'landslide', 'storm_surge']),
  })
  .strict()

// reportDocSchema — public report document
export const reportDocSchema = z
  .object({
    municipalityId: z.string().min(1),
    barangayId: z.string().min(1),
    reporterRole: z.enum(['citizen', 'responder']),
    reportType: z.enum([
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
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    status: z.enum([
      'draft_inbox',
      'new',
      'awaiting_verify',
      'verified',
      'assigned',
      'acknowledged',
      'en_route',
      'on_scene',
      'resolved',
      'closed',
      'reopened',
      'rejected',
      'cancelled',
      'cancelled_false_report',
      'merged_as_duplicate',
    ]),
    publicLocation: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .strict(),
    mediaRefs: z.array(z.string()).default([]),
    description: z.string().max(5000),
    submittedAt: z.number().int(),
    verifiedAt: z.number().int().optional(),
    retentionExempt: z.boolean().default(false),
    visibilityClass: z.enum(['internal', 'public_alertable']),
    visibility: z
      .object({
        scope: z.enum(['municipality', 'shared', 'provincial']),
        sharedWith: z.array(z.string()).default([]),
      })
      .strict(),
    source: z.enum(['web', 'sms', 'responder_witness']),
    hasPhotoAndGPS: z.boolean().default(false),
    schemaVersion: z.number().int().positive(),
    municipalityLabel: z.string().min(1).max(64),
    correlationId: z.uuid(),
  })
  .strict()

// reportPrivateDocSchema — private report document
export const reportPrivateDocSchema = z
  .object({
    municipalityId: z.string().min(1),
    reporterUid: z.string().min(1),
    isPseudonymous: z.boolean(),
    publicTrackingRef: z.string().min(1),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

// reportOpsDocSchema — operations document
export const reportOpsDocSchema = z
  .object({
    municipalityId: z.string().min(1),
    status: z.enum([
      'draft_inbox',
      'new',
      'awaiting_verify',
      'verified',
      'assigned',
      'acknowledged',
      'en_route',
      'on_scene',
      'resolved',
      'closed',
      'reopened',
      'rejected',
      'cancelled',
      'cancelled_false_report',
      'merged_as_duplicate',
    ]),
    severity: z.enum(['low', 'medium', 'high']),
    createdAt: z.number().int(),
    agencyIds: z.array(z.string()).default([]),
    activeResponderCount: z.number().int().nonnegative().default(0),
    requiresLocationFollowUp: z.boolean().default(false),
    reportType: reportOpsReportTypeSchema.optional(),
    locationGeohash: z.string().length(6).optional(),
    duplicateClusterId: z.string().optional(),
    hazardZoneIdList: z.array(z.string()).optional(),
    visibility: z
      .object({
        scope: z.enum(['municipality', 'shared', 'provincial']),
        sharedWith: z.array(z.string()).default([]),
      })
      .strict(),
    updatedAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

// reportSharingDocSchema — sharing document
export const reportSharingDocSchema = z
  .object({
    ownerMunicipalityId: z.string().min(1),
    reportId: z.string().min(1),
    sharedWith: z.array(z.string()),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

// reportNoteDocSchema — report note document
export const reportNoteDocSchema = z
  .object({
    reportId: z.string().min(1),
    authorUid: z.string().min(1),
    body: z.string().max(2000),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

// reportSharingEventDocSchema — append-only sharing audit event
export const reportSharingEventDocSchema = z
  .object({
    targetMunicipalityId: z.string().min(1),
    sharedBy: z.string().min(1),
    sharedAt: z.number().int(),
    sharedReason: z.string().max(500).optional(),
    source: z.enum(['manual', 'auto']),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

// reportContactsDocSchema — contacts document
export const reportContactsDocSchema = z
  .object({
    reportId: z.string().min(1),
    reporterUid: z.string().min(1),
    reporterName: z.string().optional(),
    reporterPhoneHash: z.string().length(64),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

// reportLookupDocSchema — lookup document
export const reportLookupDocSchema = z
  .object({
    publicTrackingRef: z.string().regex(/^[a-z0-9]{8}$/),
    reportId: z.string().min(1),
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
    expiresAt: z
      .number()
      .int()
      .max(Date.now() + 365 * 24 * 60 * 60 * 1000),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

// reportInboxDocSchema — inbox document
export const reportInboxDocSchema = z
  .object({
    reporterUid: z.string().min(1),
    clientCreatedAt: z.number().int(),
    idempotencyKey: z.string().min(1),
    publicRef: z.string().regex(/^[a-z0-9]{8}$/),
    secretHash: z.string().regex(/^[a-f0-9]{64}$/),
    correlationId: z.uuid(),
    payload: z.record(z.string(), z.unknown()),
    processedAt: z.number().int().optional(),
  })
  .strict()

export type HazardTag = z.infer<typeof hazardTagSchema>
export type ReportDoc = z.infer<typeof reportDocSchema>
export type ReportPrivateDoc = z.infer<typeof reportPrivateDocSchema>
export type ReportOpsDoc = z.infer<typeof reportOpsDocSchema>
export type ReportSharingDoc = z.infer<typeof reportSharingDocSchema>
export type ReportNoteDoc = z.infer<typeof reportNoteDocSchema>
export type ReportSharingEventDoc = z.infer<typeof reportSharingEventDocSchema>
export type ReportContactsDoc = z.infer<typeof reportContactsDocSchema>
export type ReportLookupDoc = z.infer<typeof reportLookupDocSchema>
export type ReportInboxDoc = z.infer<typeof reportInboxDocSchema>

// inboxPayloadSchema — validated payload inside report_inbox docs
export const inboxPayloadSchema = z
  .object({
    reportType: z.string().min(1).max(32),
    description: z.string().min(1).max(5000),
    severity: z.enum(['low', 'medium', 'high']),
    source: z.enum(['web', 'sms', 'responder_witness']),
    clientDraftRef: z.string().trim().min(1).max(256).optional(),
    publicLocation: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict()
      .optional(),
    exactLocation: z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      })
      .strict()
      .optional(),
    pendingMediaIds: z.array(z.string().min(1)).max(20).optional(),
    municipalityId: z.string().min(1).optional(),
    barangayId: z.string().min(1).optional(),
    nearestLandmark: z.string().max(200).optional(),
    contact: z
      .object({
        phone: msisdnPhSchema,
        smsConsent: z.literal(true),
      })
      .strict()
      .optional(),
  })
  .strict()

export type InboxPayload = z.infer<typeof inboxPayloadSchema>
