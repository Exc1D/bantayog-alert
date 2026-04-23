import { z } from 'zod';
import { dispatchStatusSchema } from './dispatches.js';
const reportStatusSchema = z.enum([
    'draft_inbox',
    'new',
    'awaiting_verify',
    'verified',
    'assigned',
    'acknowledged',
    'en_route',
    'on_scene',
    'resolved',
    'closed',
    'reopened',
    'rejected',
    'cancelled',
    'cancelled_false_report',
    'merged_as_duplicate',
]);
export const reportEventSchema = z
    .object({
    reportId: z.string().min(1),
    municipalityId: z.string().min(1),
    agencyId: z.string().optional(),
    actor: z.string().min(1),
    actorRole: z.enum([
        'citizen',
        'responder',
        'municipal_admin',
        'agency_admin',
        'provincial_superadmin',
        'system',
    ]),
    fromStatus: reportStatusSchema,
    toStatus: reportStatusSchema,
    reason: z.string().optional(),
    createdAt: z.number().int(),
    correlationId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
})
    .strict();
export const dispatchEventSchema = z
    .object({
    dispatchId: z.string().min(1),
    reportId: z.string().min(1),
    actor: z.string().min(1),
    actorRole: z.enum([
        'responder',
        'municipal_admin',
        'agency_admin',
        'provincial_superadmin',
        'system',
    ]),
    fromStatus: dispatchStatusSchema,
    toStatus: dispatchStatusSchema,
    reason: z.string().optional(),
    createdAt: z.number().int(),
    correlationId: z.string().min(1),
    schemaVersion: z.number().int().positive(),
})
    .strict();
//# sourceMappingURL=events.js.map