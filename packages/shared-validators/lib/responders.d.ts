import { z } from 'zod';
export declare const responderDocSchema: z.ZodPipe<z.ZodObject<{
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
    fcmTokens: z.ZodDefault<z.ZodArray<z.ZodString>>;
    hasFcmToken: z.ZodOptional<z.ZodBoolean>;
    lastTelemetryAt: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>, z.ZodTransform<{
    hasFcmToken: boolean;
    uid: string;
    agencyId: string;
    municipalityId: string;
    displayCode: string;
    specialisations: string[];
    availabilityStatus: "on_duty" | "off_duty" | "on_break" | "unavailable";
    isActive: boolean;
    fcmTokens: string[];
    schemaVersion: number;
    createdAt: number;
    updatedAt: number;
    lastTelemetryAt?: number | undefined;
}, {
    uid: string;
    agencyId: string;
    municipalityId: string;
    displayCode: string;
    specialisations: string[];
    availabilityStatus: "on_duty" | "off_duty" | "on_break" | "unavailable";
    isActive: boolean;
    fcmTokens: string[];
    schemaVersion: number;
    createdAt: number;
    updatedAt: number;
    hasFcmToken?: boolean | undefined;
    lastTelemetryAt?: number | undefined;
}>>;
export type ResponderDoc = z.infer<typeof responderDocSchema>;
//# sourceMappingURL=responders.d.ts.map