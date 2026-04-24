import { z } from 'zod';
export declare const moderationIncidentDocSchema: z.ZodObject<{
    reportInboxId: z.ZodOptional<z.ZodString>;
    reason: z.ZodEnum<{
        invalid_payload: "invalid_payload";
        duplicate_spam: "duplicate_spam";
        abuse_language: "abuse_language";
        rate_limit_exceeded: "rate_limit_exceeded";
        low_confidence_sms: "low_confidence_sms";
        app_check_failed: "app_check_failed";
    }>;
    source: z.ZodEnum<{
        sms: "sms";
        web: "web";
        responder_witness: "responder_witness";
    }>;
    flaggedBy: z.ZodEnum<{
        system: "system";
        ingest_trigger: "ingest_trigger";
        sms_parser: "sms_parser";
    }>;
    details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    reviewedBy: z.ZodOptional<z.ZodString>;
    reviewedAt: z.ZodOptional<z.ZodNumber>;
    disposition: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        dismissed: "dismissed";
        converted_to_report: "converted_to_report";
    }>>;
    createdAt: z.ZodNumber;
}, z.core.$strict>;
export type ModerationIncidentDoc = z.infer<typeof moderationIncidentDocSchema>;
//# sourceMappingURL=moderation.d.ts.map