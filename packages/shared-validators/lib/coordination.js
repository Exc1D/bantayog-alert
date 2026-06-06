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
    schemaVersion: z.number().int().positive(),
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
//# sourceMappingURL=coordination.js.map