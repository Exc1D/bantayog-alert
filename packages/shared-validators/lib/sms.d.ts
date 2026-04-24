import { z } from 'zod';
export declare const smsProviderIdSchema: z.ZodEnum<{
    semaphore: "semaphore";
    globelabs: "globelabs";
}>;
export declare const smsInboxDocSchema: z.ZodObject<{
    providerId: z.ZodEnum<{
        semaphore: "semaphore";
        globelabs: "globelabs";
    }>;
    receivedAt: z.ZodNumber;
    senderMsisdnHash: z.ZodString;
    senderMsisdnEnc: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    parseStatus: z.ZodEnum<{
        pending: "pending";
        parsed: "parsed";
        low_confidence: "low_confidence";
        unparseable: "unparseable";
        pending_review: "pending_review";
    }>;
    parsedIntoInboxId: z.ZodOptional<z.ZodString>;
    confidenceScore: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodNumber;
}, z.core.$strict>;
export declare const smsOutboxDocSchema: z.ZodObject<{
    providerId: z.ZodEnum<{
        semaphore: "semaphore";
        globelabs: "globelabs";
    }>;
    recipientMsisdnHash: z.ZodString;
    recipientMsisdn: z.ZodNullable<z.ZodString>;
    purpose: z.ZodEnum<{
        pending_review: "pending_review";
        receipt_ack: "receipt_ack";
        status_update: "status_update";
        verification: "verification";
        resolution: "resolution";
        mass_alert: "mass_alert";
        emergency_declaration: "emergency_declaration";
    }>;
    predictedEncoding: z.ZodEnum<{
        "GSM-7": "GSM-7";
        "UCS-2": "UCS-2";
    }>;
    predictedSegmentCount: z.ZodNumber;
    encoding: z.ZodOptional<z.ZodEnum<{
        "GSM-7": "GSM-7";
        "UCS-2": "UCS-2";
    }>>;
    segmentCount: z.ZodOptional<z.ZodNumber>;
    bodyPreviewHash: z.ZodString;
    status: z.ZodEnum<{
        queued: "queued";
        sending: "sending";
        sent: "sent";
        delivered: "delivered";
        failed: "failed";
        deferred: "deferred";
        abandoned: "abandoned";
    }>;
    statusReason: z.ZodOptional<z.ZodString>;
    terminalReason: z.ZodOptional<z.ZodEnum<{
        rejected: "rejected";
        client_err: "client_err";
        orphan: "orphan";
        abandoned_after_retries: "abandoned_after_retries";
        dlr_failed: "dlr_failed";
    }>>;
    deferralReason: z.ZodOptional<z.ZodEnum<{
        rate_limited: "rate_limited";
        provider_error: "provider_error";
        network: "network";
    }>>;
    providerMessageId: z.ZodOptional<z.ZodString>;
    reportId: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodString;
    retryCount: z.ZodNumber;
    locale: z.ZodEnum<{
        tl: "tl";
        en: "en";
    }>;
    createdAt: z.ZodNumber;
    queuedAt: z.ZodNumber;
    sentAt: z.ZodOptional<z.ZodNumber>;
    deliveredAt: z.ZodOptional<z.ZodNumber>;
    failedAt: z.ZodOptional<z.ZodNumber>;
    abandonedAt: z.ZodOptional<z.ZodNumber>;
    schemaVersion: z.ZodLiteral<2>;
}, z.core.$strict>;
export declare const smsSessionDocSchema: z.ZodObject<{
    msisdnHash: z.ZodString;
    lastReceivedAt: z.ZodNumber;
    rateLimitCount: z.ZodNumber;
    trackingPinHash: z.ZodOptional<z.ZodString>;
    trackingPinExpiresAt: z.ZodOptional<z.ZodNumber>;
    flaggedForModeration: z.ZodDefault<z.ZodBoolean>;
    updatedAt: z.ZodNumber;
}, z.core.$strict>;
export declare const smsProviderHealthDocSchema: z.ZodObject<{
    providerId: z.ZodEnum<{
        semaphore: "semaphore";
        globelabs: "globelabs";
    }>;
    circuitState: z.ZodEnum<{
        closed: "closed";
        open: "open";
        half_open: "half_open";
    }>;
    errorRatePct: z.ZodNumber;
    lastErrorAt: z.ZodOptional<z.ZodNumber>;
    openedAt: z.ZodOptional<z.ZodNumber>;
    lastProbeAt: z.ZodOptional<z.ZodNumber>;
    lastTransitionReason: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodNumber;
}, z.core.$strict>;
export declare const smsMinuteWindowDocSchema: z.ZodObject<{
    providerId: z.ZodEnum<{
        semaphore: "semaphore";
        globelabs: "globelabs";
    }>;
    windowStartMs: z.ZodNumber;
    attempts: z.ZodNumber;
    failures: z.ZodNumber;
    rateLimitedCount: z.ZodNumber;
    latencySumMs: z.ZodNumber;
    maxLatencyMs: z.ZodNumber;
    updatedAt: z.ZodNumber;
    schemaVersion: z.ZodLiteral<1>;
}, z.core.$strict>;
export type SmsInboxDoc = z.infer<typeof smsInboxDocSchema>;
export type SmsOutboxDoc = z.infer<typeof smsOutboxDocSchema>;
export type SmsSessionDoc = z.infer<typeof smsSessionDocSchema>;
export type SmsProviderHealthDoc = z.infer<typeof smsProviderHealthDocSchema>;
export type SmsMinuteWindowDoc = z.infer<typeof smsMinuteWindowDocSchema>;
export type SmsPurpose = SmsOutboxDoc['purpose'];
export declare const smsReportInboxFieldsSchema: z.ZodObject<{
    source: z.ZodLiteral<"sms">;
    sourceMsgId: z.ZodString;
    reporterMsisdnHash: z.ZodString;
    confidence: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    needsReview: z.ZodBoolean;
    requiresLocationFollowUp: z.ZodLiteral<true>;
}, z.core.$strict>;
export type SmsReportInboxFields = z.infer<typeof smsReportInboxFieldsSchema>;
//# sourceMappingURL=sms.d.ts.map
