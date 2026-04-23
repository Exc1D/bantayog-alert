import { z } from 'zod';
export declare const deadLetterDocSchema: z.ZodObject<{
    source: z.ZodString;
    originalDocRef: z.ZodString;
    failureReason: z.ZodString;
    failureStack: z.ZodOptional<z.ZodString>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    attempts: z.ZodNumber;
    firstSeenAt: z.ZodNumber;
    lastSeenAt: z.ZodNumber;
    resolvedAt: z.ZodOptional<z.ZodNumber>;
    resolvedBy: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export type DeadLetterDoc = z.infer<typeof deadLetterDocSchema>;
//# sourceMappingURL=dead-letters.d.ts.map