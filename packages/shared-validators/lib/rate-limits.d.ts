import { z } from 'zod';
export declare const rateLimitDocSchema: z.ZodObject<{
    key: z.ZodString;
    windowStartAt: z.ZodNumber;
    windowEndAt: z.ZodNumber;
    count: z.ZodNumber;
    limit: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>;
export type RateLimitDoc = z.infer<typeof rateLimitDocSchema>;
//# sourceMappingURL=rate-limits.d.ts.map