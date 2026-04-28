import { z } from 'zod';
export const incidentResponseEventSchema = z
    .object({
    incidentId: z.string().min(1),
    phase: z.enum([
        'declared',
        'contained',
        'preserved',
        'assessed',
        'notified_npc',
        'notified_subjects',
        'post_report',
        'closed',
    ]),
    actor: z.string().min(1),
    discoveredAt: z.number().int().optional(),
    notes: z.string().max(4000).optional(),
    createdAt: z.number().int(),
    correlationId: z.string().min(1),
})
    .strict();
export const dataIncidentDocSchema = z
    .object({
    incidentType: z.enum([
        'unauthorized_access',
        'data_loss',
        'data_corruption',
        'system_breach',
        'accidental_disclosure',
    ]),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    affectedCollections: z.array(z.string().min(1)),
    affectedDataClasses: z.array(z.string().min(1)),
    estimatedAffectedSubjects: z.number().int().nonnegative().optional(),
    summary: z.string().min(1).max(2000),
    status: z.enum([
        'declared',
        'contained',
        'preserved',
        'assessed',
        'notified_npc',
        'notified_subjects',
        'post_report',
        'closed',
    ]),
    declaredAt: z.number().int(),
    declaredBy: z.string().min(1),
    closedAt: z.number().int().optional(),
    retentionExempt: z.boolean(),
    schemaVersion: z.number().int().positive(),
})
    .strict()
    .refine((data) => !data.closedAt || data.closedAt >= data.declaredAt, {
    message: 'closedAt must be greater than or equal to declaredAt',
});
//# sourceMappingURL=incident-response.js.map