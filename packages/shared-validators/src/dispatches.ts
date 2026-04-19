import { z } from 'zod'

// Accepts both Firebase Storage and generic GCS URLs to support storage migration.
// The https://firebasestorage.googleapis.com/ domain is the standard Firebase Storage API endpoint.
// The https://storage.googleapis.com/ domain is the raw GCS API, used when we need
// direct GCS integration or during migration between storage backends.
const firebaseStorageUrl = z
  .string()
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  .url()
  .refine(
    (val) =>
      val.startsWith('https://firebasestorage.googleapis.com/') ||
      val.startsWith('https://storage.googleapis.com/'),
    {
      message:
        'Must be a Firebase Storage URL (https://firebasestorage.googleapis.com/...) or GCS URL (https://storage.googleapis.com/...)',
    },
  )

export const dispatchStatusSchema = z.enum([
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'declined',
  'timed_out',
  'cancelled',
  'superseded',
])

export type DispatchStatus = z.infer<typeof dispatchStatusSchema>

export const dispatchDocSchema = z
  .object({
    reportId: z.string().min(1),
    assignedTo: z.object({
      uid: z.string().min(1),
      agencyId: z.string().min(1),
      municipalityId: z.string().min(1),
    }),
    dispatchedBy: z.string().min(1),
    dispatchedByRole: z.enum(['municipal_admin', 'agency_admin']),
    dispatchedAt: z.number().int(),
    status: dispatchStatusSchema,
    statusUpdatedAt: z.number().int(),
    acknowledgementDeadlineAt: z.number().int(),
    acknowledgedAt: z.number().int().optional(),
    enRouteAt: z.number().int().optional(),
    onSceneAt: z.number().int().optional(),
    resolvedAt: z.number().int().optional(),
    cancelledAt: z.number().int().optional(),
    cancelledBy: z.string().optional(),
    cancelReason: z.string().optional(),
    timeoutReason: z.string().optional(),
    declineReason: z.string().optional(),
    resolutionSummary: z.string().optional(),
    proofPhotoUrl: firebaseStorageUrl.optional(),
    requestedByMunicipalAdmin: z.boolean().optional(),
    requestId: z.string().optional(),
    idempotencyKey: z.string().min(1),
    idempotencyPayloadHash: z.string().length(64),
    schemaVersion: z.number().int().positive(),
  })
  .strict()

const advanceDispatchTargetSchema = z.enum(['acknowledged', 'en_route', 'on_scene', 'resolved'])

export const advanceDispatchRequestSchema = z
  .object({
    dispatchId: z.string().min(1),
    to: advanceDispatchTargetSchema,
    resolutionSummary: z.string().optional(),
    idempotencyKey: z.uuid(),
  })
  .strict()

export type AdvanceDispatchTarget = z.infer<typeof advanceDispatchTargetSchema>
export type AdvanceDispatchRequest = z.infer<typeof advanceDispatchRequestSchema>
export type DispatchDoc = z.infer<typeof dispatchDocSchema>
