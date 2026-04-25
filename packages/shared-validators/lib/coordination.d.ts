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
    respondedBy: z.ZodOptional<z.ZodString>;
    escalatedAt: z.ZodOptional<z.ZodNumber>;
    expiresAt: z.ZodNumber;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const commandChannelThreadDocSchema: z.ZodObject<{
    threadId: z.ZodString;
    reportId: z.ZodString;
    threadType: z.ZodEnum<{
        agency_assistance: "agency_assistance";
        border_share: "border_share";
    }>;
    assistanceRequestId: z.ZodOptional<z.ZodString>;
    subject: z.ZodString;
    participantUids: z.ZodRecord<z.ZodString, z.ZodLiteral<true>>;
    createdBy: z.ZodString;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    lastMessageAt: z.ZodOptional<z.ZodNumber>;
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
    idempotencyKey: z.ZodOptional<z.ZodUUID>;
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
        declined: "declined";
        queued: "queued";
        sent: "sent";
        pending_ndrrmc_review: "pending_ndrrmc_review";
        submitted_to_pdrrmo: "submitted_to_pdrrmo";
        forwarded_to_ndrrmc: "forwarded_to_ndrrmc";
        acknowledged_by_ndrrmc: "acknowledged_by_ndrrmc";
        cancelled: "cancelled";
    }>;
    createdAt: z.ZodNumber;
    forwardedAt: z.ZodOptional<z.ZodNumber>;
    forwardMethod: z.ZodOptional<z.ZodString>;
    ndrrrcRecipient: z.ZodOptional<z.ZodString>;
    acknowledgedAt: z.ZodOptional<z.ZodNumber>;
    cancelledAt: z.ZodOptional<z.ZodNumber>;
    sentAt: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const shiftHandoffDocSchema: z.ZodObject<{
    fromUid: z.ZodString;
    toUid: z.ZodOptional<z.ZodString>;
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
    escalatedAt: z.ZodOptional<z.ZodNumber>;
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
export declare const fieldModeSessionDocSchema: z.ZodObject<{
    uid: z.ZodString;
    municipalityId: z.ZodString;
    enteredAt: z.ZodNumber;
    expiresAt: z.ZodNumber;
    exitedAt: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodBoolean;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export type AgencyAssistanceRequestDoc = z.infer<typeof agencyAssistanceRequestDocSchema>;
export type CommandChannelThreadDoc = z.infer<typeof commandChannelThreadDocSchema>;
export type CommandChannelMessageDoc = z.infer<typeof commandChannelMessageDocSchema>;
export type MassAlertRequestDoc = z.infer<typeof massAlertRequestDocSchema>;
export type ShiftHandoffDoc = z.infer<typeof shiftHandoffDocSchema>;
export type BreakglassEventDoc = z.infer<typeof breakglassEventDocSchema>;
export type FieldModeSessionDoc = z.infer<typeof fieldModeSessionDocSchema>;
//# sourceMappingURL=coordination.d.ts.map