import { z } from 'zod'

export const minAppVersionSchema = z.object({
  citizen: z.string().min(1),
  admin: z.string().min(1),
  responder: z.string().min(1),
  updatedAt: z.number().int().nonnegative(),
})
