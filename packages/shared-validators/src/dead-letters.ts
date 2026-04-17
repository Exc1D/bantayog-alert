import { z } from 'zod'

export const deadLetterDocSchema = z
  .object({
    source: z.string().min(1),
    originalDocRef: z.string().min(1),
    failureReason: z.string().min(1),
    failureStack: z.string().optional(),
    payload: z.record(z.string(), z.unknown()),
    attempts: z.number().int().positive(),
    firstSeenAt: z.number().int(),
    lastSeenAt: z.number().int(),
    resolvedAt: z.number().int().optional(),
    resolvedBy: z.string().optional(),
  })
  .strict()

export type DeadLetterDoc = z.infer<typeof deadLetterDocSchema>
