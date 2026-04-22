import { z } from 'zod'

export const smsProviderIdSchema = z.enum(['semaphore', 'globelabs'])

export const smsInboxDocSchema = z
  .object({
    providerId: smsProviderIdSchema,
    receivedAt: z.number().int(),
    senderMsisdnHash: z
      .string()
      .length(64)
      .regex(/^[a-f0-9]{64}$/),
    senderMsisdnEnc: z.string().optional(),
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
    recipientMsisdn: z.string().nullable(),
    purpose: z.enum([
      'receipt_ack',
      'status_update',
      'verification',
      'resolution',
      'mass_alert',
      'emergency_declaration',
    ]),
    predictedEncoding: z.enum(['GSM-7', 'UCS-2']),
    predictedSegmentCount: z.number().int().positive(),
    encoding: z.enum(['GSM-7', 'UCS-2']).optional(),
    segmentCount: z.number().int().positive().optional(),
    bodyPreviewHash: z.string().length(64),
    status: z.enum(['queued', 'sending', 'sent', 'delivered', 'failed', 'deferred', 'abandoned']),
    statusReason: z.string().optional(),
    terminalReason: z
      .enum(['rejected', 'client_err', 'orphan', 'abandoned_after_retries', 'dlr_failed'])
      .optional(),
    deferralReason: z.enum(['rate_limited', 'provider_error', 'network']).optional(),
    providerMessageId: z.string().optional(),
    reportId: z.string().optional(),
    idempotencyKey: z.string().min(1),
    retryCount: z.number().int().nonnegative(),
    locale: z.enum(['tl', 'en']),
    createdAt: z.number().int(),
    queuedAt: z.number().int(),
    sentAt: z.number().int().optional(),
    deliveredAt: z.number().int().optional(),
    failedAt: z.number().int().optional(),
    abandonedAt: z.number().int().optional(),
    schemaVersion: z.literal(2),
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
    openedAt: z.number().int().optional(),
    lastProbeAt: z.number().int().optional(),
    lastTransitionReason: z.string().max(200).optional(),
    updatedAt: z.number().int(),
  })
  .strict()

export const smsMinuteWindowDocSchema = z
  .object({
    providerId: smsProviderIdSchema,
    windowStartMs: z.number().int(),
    attempts: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative(),
    rateLimitedCount: z.number().int().nonnegative(),
    latencySumMs: z.number().int().nonnegative(),
    maxLatencyMs: z.number().int().nonnegative(),
    updatedAt: z.number().int(),
    schemaVersion: z.literal(1),
  })
  .strict()

export type SmsInboxDoc = z.infer<typeof smsInboxDocSchema>
export type SmsOutboxDoc = z.infer<typeof smsOutboxDocSchema>
export type SmsSessionDoc = z.infer<typeof smsSessionDocSchema>
export type SmsProviderHealthDoc = z.infer<typeof smsProviderHealthDocSchema>
export type SmsMinuteWindowDoc = z.infer<typeof smsMinuteWindowDocSchema>
export type SmsPurpose = SmsOutboxDoc['purpose']

export const smsReportInboxFieldsSchema = z
  .object({
    source: z.literal('sms'),
    sourceMsgId: z.string(),
    reporterMsisdnHash: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
    needsReview: z.boolean(),
    requiresLocationFollowUp: z.literal(true),
  })
  .strict()

export type SmsReportInboxFields = z.infer<typeof smsReportInboxFieldsSchema>
