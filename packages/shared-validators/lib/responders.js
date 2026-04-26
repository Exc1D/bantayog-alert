import { z } from 'zod';
export const responderDocSchema = z
    .object({
    uid: z.string().min(1),
    agencyId: z.string().min(1),
    municipalityId: z.string().min(1),
    displayCode: z.string().min(1),
    specialisations: z.array(z.string()).default([]),
    availabilityStatus: z.enum(['available', 'on_duty', 'off_duty', 'on_break', 'unavailable']),
    availabilityReason: z.string().max(500).optional(),
    isActive: z.boolean(),
    fcmTokens: z.array(z.string().trim().min(1)).default([]),
    hasFcmToken: z.boolean().default(false),
    lastTelemetryAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
})
    .strict();
export const responderTelemetryPayloadSchema = z
    .object({
    capturedAt: z.number(),
    receivedAt: z.number().optional(),
    lat: z.number(),
    lng: z.number(),
    accuracy: z.number(),
    batteryPct: z.number().min(0).max(100),
    motionState: z.enum(['moving', 'walking', 'still', 'unknown']),
    appVersion: z.string(),
    telemetryStatus: z.enum(['active', 'degraded', 'stale', 'offline']),
})
    .strict();
//# sourceMappingURL=responders.js.map