import { z } from 'zod'

export const acceptDispatchRequestSchema = z
  .object({
    dispatchId: z.string().min(1).max(128),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    idempotencyKey: z.string().uuid(),
  })
  .strict()

export type AcceptDispatchRequest = z.infer<typeof acceptDispatchRequestSchema>
