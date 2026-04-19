import { z } from 'zod'
export const closeReportRequestSchema = z.object({
  reportId: z.string().min(1).max(128),
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  idempotencyKey: z.string().uuid(),
  closureSummary: z.string().min(1).max(2000).optional(),
})
export type CloseReportRequest = z.infer<typeof closeReportRequestSchema>
