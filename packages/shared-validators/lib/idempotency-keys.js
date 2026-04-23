import { z } from 'zod';
export const idempotencyKeyDocSchema = z
    .object({
    key: z.string().min(1),
    payloadHash: z.string().length(64),
    firstSeenAt: z.number().int(),
    expiresAt: z.number().int().optional(),
    resultRef: z.string().optional(),
    resultPayload: z.record(z.string(), z.unknown()).optional(),
})
    .strict();
//# sourceMappingURL=idempotency-keys.js.map