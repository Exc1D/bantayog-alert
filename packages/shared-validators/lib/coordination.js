import { z } from 'zod';
export const agencyAssistanceRequestDocSchema = z
    .object({
    reportId: z.string().min(1),
    requestedByMunicipalId: z.string().min(1),
    requestedByMunicipality: z.string().min(1),
    targetAgencyId: z.string().min(1),
    requestType: z.enum(['BFP', 'PNP', 'PCG', 'RED_CROSS', 'DPWH', 'OTHER']),
    message: z.string().max(1000),
    priority: z.enum(['urgent', 'normal']),
    status: z.enum(['pending', 'accepted', 'declined', 'fulfilled', 'expired']),
    declinedReason: z.string().optional(),
    fulfilledByDispatchIds: z.array(z.string()),
    createdAt: z.number().int(),
    respondedAt: z.number().int().optional(),
    respondedBy: z.string().optional(),
    escalatedAt: z.number().int().optional(),
    expiresAt: z.number().int(),
})
    .strict()
    // Assistance windows must have a positive duration — expiresAt is set by the
    // requesting municipality and must exceed the request creation timestamp.
    .refine((d) => d.expiresAt > d.createdAt, {
    message: 'expiresAt must be after createdAt',
});
export const commandChannelThreadDocSchema = z
    .object({
    threadId: z.string().min(1),
    reportId: z.string().min(1),
    threadType: z.enum(['agency_assistance', 'border_share']),
    assistanceRequestId: z.string().min(1).optional(),
    subject: z.string().max(200),
    participantUids: z.record(z.string(), z.literal(true)),
    createdBy: z.string().min(1),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
    lastMessageAt: z.number().int().optional(),
    closedAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const commandChannelMessageDocSchema = z
    .object({
    threadId: z.string().min(1),
    authorUid: z.string().min(1),
    // Responders appear in participantUids but cannot author messages;
    // command channel posts are admin/agency/superadmin only.
    authorRole: z.enum(['municipal_admin', 'agency_admin', 'provincial_superadmin']),
    body: z.string().max(2000),
    idempotencyKey: z.uuid().optional(),
    createdAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const massAlertRequestDocSchema = z
    .object({
    requestedByMunicipality: z.string().min(1),
    requestedByUid: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high']),
    body: z.string().max(480),
    targetType: z.enum(['municipality', 'polygon', 'province']),
    targetGeometryRef: z.string().optional(),
    estimatedReach: z.number().int().nonnegative(),
    status: z.enum([
        'queued',
        'sent',
        'pending_ndrrmc_review',
        'submitted_to_pdrrmo',
        'forwarded_to_ndrrmc',
        'acknowledged_by_ndrrmc',
        'declined',
        'cancelled',
    ]),
    createdAt: z.number().int(),
    forwardedAt: z.number().int().optional(),
    forwardMethod: z.string().optional(),
    ndrrrcRecipient: z.string().optional(),
    acknowledgedAt: z.number().int().optional(),
    cancelledAt: z.number().int().optional(),
    sentAt: z.number().int().optional(),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const shiftHandoffDocSchema = z
    .object({
    fromUid: z.string().min(1),
    toUid: z.string().min(1).optional(),
    municipalityId: z.string().min(1),
    activeIncidentSnapshot: z.array(z.string()),
    notes: z.string().max(2000),
    status: z.enum(['pending', 'accepted', 'expired']),
    createdAt: z.number().int(),
    acceptedAt: z.number().int().optional(),
    escalatedAt: z.number().int().optional(),
    expiresAt: z.number().int(),
    schemaVersion: z.number().int().positive(),
})
    .strict()
    .refine((d) => d.expiresAt > d.createdAt, {
    message: 'expiresAt must be after createdAt',
});
export const breakglassEventDocSchema = z
    .object({
    sessionId: z.string().min(1),
    actor: z.string().min(1),
    action: z.string().min(1),
    resourceRef: z.string().optional(),
    createdAt: z.number().int(),
    correlationId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const fieldModeSessionDocSchema = z
    .object({
    uid: z.string().min(1),
    municipalityId: z.string().min(1),
    enteredAt: z.number().int(),
    expiresAt: z.number().int(),
    exitedAt: z.number().int().optional(),
    isActive: z.boolean(),
    schemaVersion: z.number().int().positive(),
})
    .strict()
    .refine((d) => d.expiresAt > d.enteredAt, {
    message: 'expiresAt must be after enteredAt',
});
//# sourceMappingURL=coordination.js.map