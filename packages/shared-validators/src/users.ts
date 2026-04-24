import { z } from 'zod'

export const userDocSchema = z
  .object({
    uid: z.string().min(1),
    role: z.enum([
      'citizen',
      'responder',
      'municipal_admin',
      'agency_admin',
      'provincial_superadmin',
    ]),
    displayName: z.string().optional(),
    phone: z.string().optional(),
    barangayId: z.string().optional(),
    municipalityId: z.string().optional(),
    agencyId: z.string().optional(),
    isPseudonymous: z.boolean(),
    followUpConsent: z.boolean().default(false),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .strict()

export const reportSmsConsentDocSchema = z
  .object({
    reportId: z.string().min(1),
    phone: z.string().min(1),
    locale: z.string().min(1),
    smsConsent: z.literal(true),
    municipalityId: z.string().min(1),
    followUpConsent: z.boolean().default(false),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type UserDoc = z.infer<typeof userDocSchema>
export type ReportSmsConsentDoc = z.infer<typeof reportSmsConsentDocSchema>
