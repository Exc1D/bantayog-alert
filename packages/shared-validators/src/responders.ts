import { z } from 'zod'

export const responderDocSchema = z
  .object({
    uid: z.string().min(1),
    agencyId: z.string().min(1),
    municipalityId: z.string().min(1),
    displayCode: z.string().min(1),
    specialisations: z.array(z.string()).default([]),
    availabilityStatus: z.enum(['on_duty', 'off_duty', 'on_break', 'unavailable']),
    lastTelemetryAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict()

export type ResponderDoc = z.infer<typeof responderDocSchema>
