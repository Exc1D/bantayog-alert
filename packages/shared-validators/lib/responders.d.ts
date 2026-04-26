import { z } from 'zod';
export declare const responderDocSchema: z.ZodObject<{
    uid: z.ZodString;
    agencyId: z.ZodString;
    municipalityId: z.ZodString;
    displayCode: z.ZodString;
    specialisations: z.ZodDefault<z.ZodArray<z.ZodString>>;
    availabilityStatus: z.ZodEnum<{
        available: "available";
        on_duty: "on_duty";
        off_duty: "off_duty";
        on_break: "on_break";
        unavailable: "unavailable";
    }>;
    availabilityReason: z.ZodOptional<z.ZodString>;
    isActive: z.ZodBoolean;
    fcmTokens: z.ZodDefault<z.ZodArray<z.ZodString>>;
    hasFcmToken: z.ZodDefault<z.ZodBoolean>;
    lastTelemetryAt: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, z.core.$strict>;
export declare const responderTelemetryPayloadSchema: z.ZodObject<{
    capturedAt: z.ZodNumber;
    receivedAt: z.ZodOptional<z.ZodNumber>;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    accuracy: z.ZodNumber;
    batteryPct: z.ZodNumber;
    motionState: z.ZodEnum<{
        unknown: "unknown";
        moving: "moving";
        walking: "walking";
        still: "still";
    }>;
    appVersion: z.ZodString;
    telemetryStatus: z.ZodEnum<{
        active: "active";
        degraded: "degraded";
        stale: "stale";
        offline: "offline";
    }>;
}, z.core.$strict>;
export type ResponderTelemetryPayload = z.infer<typeof responderTelemetryPayloadSchema>;
export type ResponderDoc = z.infer<typeof responderDocSchema>;
//# sourceMappingURL=responders.d.ts.map