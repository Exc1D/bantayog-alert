import { z } from 'zod';
export declare const responderDocSchema: z.ZodObject<{
    uid: z.ZodString;
    agencyId: z.ZodString;
    municipalityId: z.ZodString;
    displayCode: z.ZodString;
    specialisations: z.ZodDefault<z.ZodArray<z.ZodString>>;
    availabilityStatus: z.ZodEnum<{
        on_duty: "on_duty";
        off_duty: "off_duty";
        on_break: "on_break";
        unavailable: "unavailable";
    }>;
    isActive: z.ZodBoolean;
    lastTelemetryAt: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>;
export type ResponderDoc = z.infer<typeof responderDocSchema>;
//# sourceMappingURL=responders.d.ts.map