import { z } from 'zod';
export declare const agencyAssistanceRequestDocSchema: z.ZodObject<{
    reportId: z.ZodString;
    requestedByMunicipalId: z.ZodString;
    requestedByMunicipality: z.ZodString;
    targetAgencyId: z.ZodString;
    requestType: z.ZodEnum<{
        BFP: "BFP";
        PNP: "PNP";
        PCG: "PCG";
        RED_CROSS: "RED_CROSS";
        DPWH: "DPWH";
        OTHER: "OTHER";
    }>;
    message: z.ZodString;
    priority: z.ZodEnum<{
        urgent: "urgent";
        normal: "normal";
    }>;
    status: z.ZodEnum<{
        pending: "pending";
        accepted: "accepted";
        declined: "declined";
        fulfilled: "fulfilled";
        expired: "expired";
    }>;
    declinedReason: z.ZodOptional<z.ZodString>;
    fulfilledByDispatchIds: z.ZodArray<z.ZodString>;
    createdAt: z.ZodNumber;
    respondedAt: z.ZodOptional<z.ZodNumber>;
    expiresAt: z.ZodNumber;
}, z.core.$strict>;
export declare const commandChannelThreadDocSchema: z.ZodObject<{
    threadId: z.ZodString;
    reportId: z.ZodOptional<z.ZodString>;
    subject: z.ZodString;
    participantUids: z.ZodRecord<z.ZodString, z.ZodLiteral<true>>;
    createdBy: z.ZodString;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    closedAt: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const commandChannelMessageDocSchema: z.ZodObject<{
    threadId: z.ZodString;
    authorUid: z.ZodString;
    authorRole: z.ZodEnum<{
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
        provincial_superadmin: "provincial_superadmin";
    }>;
    body: z.ZodString;
    createdAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const massAlertRequestDocSchema: z.ZodObject<{
    requestedByMunicipality: z.ZodString;
    requestedByUid: z.ZodString;
    severity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    body: z.ZodString;
    targetType: z.ZodEnum<{
        municipality: "municipality";
        polygon: "polygon";
        province: "province";
    }>;
    targetGeometryRef: z.ZodOptional<z.ZodString>;
    estimatedReach: z.ZodNumber;
    status: z.ZodEnum<{
        queued: "queued";
        submitted_to_pdrrmo: "submitted_to_pdrrmo";
        forwarded_to_ndrrmc: "forwarded_to_ndrrmc";
        acknowledged_by_ndrrmc: "acknowledged_by_ndrrmc";
        cancelled: "cancelled";
    }>;
    createdAt: z.ZodNumber;
    forwardedAt: z.ZodOptional<z.ZodNumber>;
    acknowledgedAt: z.ZodOptional<z.ZodNumber>;
    cancelledAt: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const shiftHandoffDocSchema: z.ZodObject<{
    fromUid: z.ZodString;
    toUid: z.ZodString;
    municipalityId: z.ZodString;
    activeIncidentSnapshot: z.ZodArray<z.ZodString>;
    notes: z.ZodString;
    status: z.ZodEnum<{
        pending: "pending";
        accepted: "accepted";
        expired: "expired";
    }>;
    createdAt: z.ZodNumber;
    acceptedAt: z.ZodOptional<z.ZodNumber>;
    expiresAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const breakglassEventDocSchema: z.ZodObject<{
    sessionId: z.ZodString;
    actor: z.ZodString;
    action: z.ZodString;
    resourceRef: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodNumber;
    correlationId: z.ZodString;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type AgencyAssistanceRequestDoc = z.infer<typeof agencyAssistanceRequestDocSchema>;
export type CommandChannelThreadDoc = z.infer<typeof commandChannelThreadDocSchema>;
export type CommandChannelMessageDoc = z.infer<typeof commandChannelMessageDocSchema>;
export type MassAlertRequestDoc = z.infer<typeof massAlertRequestDocSchema>;
export type ShiftHandoffDoc = z.infer<typeof shiftHandoffDocSchema>;
export type BreakglassEventDoc = z.infer<typeof breakglassEventDocSchema>;
//# sourceMappingURL=coordination.d.ts.map