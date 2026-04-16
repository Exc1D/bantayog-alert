import { z } from 'zod'
import { INCIDENT_TYPES, LOCATION_PRECISIONS, REPORT_SOURCES, SEVERITIES } from '@bantayog/shared-types'

const firestoreTimestampSchema = z.object({
  seconds: z.number(),
  nanoseconds: z.number(),
})

const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export const reportInboxPayloadSchema = z
  .object({
    type: z.enum(INCIDENT_TYPES),
    description: z.string().min(1).max(2000),
    municipalityId: z.string().min(1),
    barangayId: z.string().min(1),
    locationPrecision: z.enum(LOCATION_PRECISIONS),
    exactLocation: geoPointSchema.optional(),
    mediaIds: z.array(z.string()).optional(),
    source: z.enum(REPORT_SOURCES).optional(),
    severity: z.enum(SEVERITIES).optional(),
  })
  .refine((data) => data.source !== 'responder_witness', {
    message: 'responder_witness source is not allowed via report_inbox (use submitResponderWitnessedReport callable)',
  })

export const reportInboxItemSchema = z.object({
  reporterUid: z.string().min(1),
  clientCreatedAt: firestoreTimestampSchema,
  payload: reportInboxPayloadSchema,
  idempotencyKey: z.string().min(1),
})
