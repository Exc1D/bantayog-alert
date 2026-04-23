import { z } from 'zod';
export const moderationIncidentDocSchema = z
    .object({
    reportInboxId: z.string().optional(),
    reason: z.enum([
        'invalid_payload',
        'duplicate_spam',
        'abuse_language',
        'rate_limit_exceeded',
        'low_confidence_sms',
        'app_check_failed',
    ]),
    source: z.enum(['web', 'sms', 'responder_witness']),
    flaggedBy: z.enum(['system', 'ingest_trigger', 'sms_parser']),
    details: z.record(z.string(), z.unknown()).optional(),
    reviewedBy: z.string().optional(),
    reviewedAt: z.number().int().optional(),
    disposition: z.enum(['pending', 'dismissed', 'converted_to_report']).default('pending'),
    createdAt: z.number().int(),
})
    .strict();
//# sourceMappingURL=moderation.js.map