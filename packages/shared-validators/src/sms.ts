import { z } from 'zod'

export const smsProviderIdSchema = z.enum(['semaphore', 'globelabs'])

export const smsInboxDocSchema = z
  .object({
    providerId: smsProviderIdSchema,
    receivedAt: z.number().int(),
    senderMsisdnHash: z.string().length(64),
    body: z.string().max(1600),
    parseStatus: z.enum(['pending', 'parsed', 'low_confidence', 'unparseable']),
    parsedIntoInboxId: z.string().optional(),
    confidenceScore: z.number().min(0).max(1).optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const smsOutboxDocSchema = z
  .object({
    providerId: smsProviderIdSchema,
    recipientMsisdnHash: z.string().length(64),
    purpose: z.enum([
      'receipt_ack',
      'status_update',
      'verification',
      'resolution',
      'mass_alert',
      'emergency_declaration',
    ]),
    encoding: z.enum(['GSM-7', 'UCS-2']),
    segmentCount: z.number().int().positive(),
    bodyPreviewHash: z.string().length(64),
    status: z.enum(['queued', 'sent', 'delivered', 'failed', 'undelivered', 'abandoned']),
    statusReason: z.string().optional(),
    providerMessageId: z.string().optional(),
    reportId: z.string().optional(),
    idempotencyKey: z.string().min(1),
    createdAt: z.number().int(),
    sentAt: z.number().int().optional(),
    deliveredAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export const smsSessionDocSchema = z
  .object({
    msisdnHash: z.string().length(64),
    lastReceivedAt: z.number().int(),
    rateLimitCount: z.number().int().nonnegative(),
    trackingPinHash: z.string().length(64).optional(),
    trackingPinExpiresAt: z.number().int().optional(),
    flaggedForModeration: z.boolean().default(false),
    updatedAt: z.number().int(),
  })
  .strict()

export const smsProviderHealthDocSchema = z
  .object({
    providerId: smsProviderIdSchema,
    circuitState: z.enum(['closed', 'open', 'half_open']),
    errorRatePct: z.number().min(0).max(100),
    lastErrorAt: z.number().int().optional(),
    updatedAt: z.number().int(),
  })
  .strict()

export type SmsInboxDoc = z.infer<typeof smsInboxDocSchema>
export type SmsOutboxDoc = z.infer<typeof smsOutboxDocSchema>
export type SmsSessionDoc = z.infer<typeof smsSessionDocSchema>
export type SmsProviderHealthDoc = z.infer<typeof smsProviderHealthDocSchema>
