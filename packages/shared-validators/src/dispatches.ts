import { z } from 'zod'

export const dispatchStatusSchema = z.enum([
  'pending',
  'accepted',
  'acknowledged',
  'in_progress',
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'superseded',
])

export const dispatchDocSchema = z
  .object({
    reportId: z.string().min(1),
    responderId: z.string().min(1),
    municipalityId: z.string().min(1),
    agencyId: z.string().min(1),
    dispatchedBy: z.string().min(1),
    dispatchedByRole: z.enum(['municipal_admin', 'agency_admin']),
    dispatchedAt: z.number().int(),
    status: dispatchStatusSchema,
    statusUpdatedAt: z.number().int(),
    acknowledgementDeadlineAt: z.number().int(),
    acknowledgedAt: z.number().int().optional(),
    inProgressAt: z.number().int().optional(),
    resolvedAt: z.number().int().optional(),
    cancelledAt: z.number().int().optional(),
    cancelledBy: z.string().optional(),
    cancelReason: z.string().optional(),
    timeoutReason: z.string().optional(),
    declineReason: z.string().optional(),
    resolutionSummary: z.string().optional(),
    proofPhotoUrl: z.url().optional(),
    requestedByMunicipalAdmin: z.boolean().optional(),
    requestId: z.string().optional(),
    idempotencyKey: z.string().min(1),
    idempotencyPayloadHash: z.string().length(64),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

export type DispatchDoc = z.infer<typeof dispatchDocSchema>
