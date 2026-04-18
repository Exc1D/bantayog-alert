import { z } from 'zod'

const bbox = z
  .object({
    minLat: z.number(),
    minLng: z.number(),
    maxLat: z.number(),
    maxLng: z.number(),
  })
  .strict()

const hazardTypeSchema = z.enum(['flood', 'landslide', 'storm_surge'])

export const hazardZoneDocSchema = z
  .object({
    zoneType: z.enum(['reference', 'custom']),
    hazardType: hazardTypeSchema,
    hazardSeverity: z.enum(['low', 'medium', 'high']).optional(),
    scope: z.enum(['provincial', 'municipality']),
    municipalityId: z.string().optional(),
    displayName: z.string().max(200),
    polygonRef: z.string().min(1),
    bbox,
    geohashPrefix: z.string().length(6),
    vertexCount: z.number().int().positive(),
    version: z.number().int().positive(),
    supersededBy: z.string().optional(),
    supersededAt: z.number().int().optional(),
    expiresAt: z.number().int().optional(),
    expiredAt: z.number().int().optional(),
    deletedAt: z.number().int().optional(),
    createdBy: z.string().min(1),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()
  .refine(
    (d) =>
      (d.supersededBy !== undefined && d.supersededAt !== undefined) ||
      (d.supersededBy === undefined && d.supersededAt === undefined),
    { message: 'supersededBy and supersededAt must both be present or both absent' },
  )

export const hazardZoneHistoryDocSchema = hazardZoneDocSchema.extend({
  historyVersion: z.number().int().positive(),
})

export const hazardSignalDocSchema = z
  .object({
    source: z.enum(['pagasa_webhook', 'pagasa_scraper', 'manual_superadmin']),
    signalLevel: z.number().int().min(0).max(5),
    affectedMunicipalityIds: z.array(z.string()),
    createdAt: z.number().int(),
    expiresAt: z.number().int().optional(),
    createdBy: z.string().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type HazardZoneDoc = z.infer<typeof hazardZoneDocSchema>
export type HazardZoneHistoryDoc = z.infer<typeof hazardZoneHistoryDocSchema>
export type HazardSignalDoc = z.infer<typeof hazardSignalDocSchema>
