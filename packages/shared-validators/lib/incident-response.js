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
//# sourceMappingURL=incident-response.js.map