import { z } from 'zod'

export const alertDocSchema = z
  .object({
    title: z.string().min(1).max(200),
    body: z.string().max(2000),
    severity: z.enum(['low', 'medium', 'high']),
    publishedAt: z.number().int(),
    publishedBy: z.string().min(1),
    sentAt: z.number().int().optional(),
    targetMunicipalityIds: z.array(z.string()).min(1),
    visibility: z.enum(['public', 'internal']).default('public'),
    schemaVersion: z.number().int().positive().default(1),
  })
  .strict()

export const emergencyDocSchema = z
  .object({
    declaredBy: z.string().min(1),
    declaredAt: z.number().int(),
    title: z.string().min(1).max(200),
    body: z.string().max(2000),
    affectedMunicipalityIds: z.array(z.string()).min(1),
    clearsAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type AlertDoc = z.infer<typeof alertDocSchema>
export type EmergencyDoc = z.infer<typeof emergencyDocSchema>
