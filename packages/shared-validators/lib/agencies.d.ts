import { z } from 'zod';
export declare const agencyDocSchema: z.ZodObject<{
    agencyId: z.ZodString;
    displayName: z.ZodString;
    shortCode: z.ZodEnum<{
        BFP: "BFP";
        PNP: "PNP";
        PCG: "PCG";
        RED_CROSS: "RED_CROSS";
        DPWH: "DPWH";
        OTHER: "OTHER";
    }>;
    jurisdiction: z.ZodEnum<{
        provincial: "provincial";
        municipal: "municipal";
        national: "national";
    }>;
    contactEmail: z.ZodOptional<z.ZodEmail>;
    contactPhone: z.ZodOptional<z.ZodString>;
    dispatchDefaults: z.ZodOptional<z.ZodObject<{
        timeoutHighMs: z.ZodNumber;
        timeoutMediumMs: z.ZodNumber;
        timeoutLowMs: z.ZodNumber;
    }, z.core.$strict>>;
    schemaVersion: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>;
export type AgencyDoc = z.infer<typeof agencyDocSchema>;
//# sourceMappingURL=agencies.d.ts.map