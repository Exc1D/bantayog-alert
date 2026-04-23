import { z } from 'zod';
export declare const idempotencyKeyDocSchema: z.ZodObject<{
    key: z.ZodString;
    payloadHash: z.ZodString;
    firstSeenAt: z.ZodNumber;
    expiresAt: z.ZodOptional<z.ZodNumber>;
    resultRef: z.ZodOptional<z.ZodString>;
    resultPayload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>;
export type IdempotencyKeyDoc = z.infer<typeof idempotencyKeyDocSchema>;
//# sourceMappingURL=idempotency-keys.d.ts.map