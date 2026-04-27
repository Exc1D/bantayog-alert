import { z } from 'zod';
export const agencyDocSchema = z
    .object({
    agencyId: z.string().min(1),
    displayName: z.string().min(1),
    shortCode: z.enum(['BFP', 'PNP', 'PCG', 'RED_CROSS', 'DPWH', 'OTHER']),
    jurisdiction: z.enum(['provincial', 'municipal', 'national']),
    contactEmail: z.email().optional(),
    contactPhone: z.string().optional(),
    mutualAidVisible: z.boolean().optional(),
    dispatchDefaults: z
        .object({
        timeoutHighMs: z.number().int().positive(),
        timeoutMediumMs: z.number().int().positive(),
        timeoutLowMs: z.number().int().positive(),
    })
        .strict()
        .optional(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
})
    .strict();
//# sourceMappingURL=agencies.js.map