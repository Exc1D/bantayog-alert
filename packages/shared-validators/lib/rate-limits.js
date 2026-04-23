import { z } from 'zod';
export const rateLimitDocSchema = z
    .object({
    key: z.string().min(1),
    windowStartAt: z.number().int(),
    windowEndAt: z.number().int(),
    count: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    updatedAt: z.number().int(),
})
    .strict();
//# sourceMappingURL=rate-limits.js.map