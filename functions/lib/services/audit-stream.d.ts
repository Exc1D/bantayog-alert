/**
 * audit-stream.ts
 *
 * Fire-and-forget audit event streaming to BigQuery.
 * All PRE-7 callables call streamAuditEvent() — never throws.
 * Requires infra: bantayog_audit.streaming_events table — see infra/bigquery/
 */
export interface AuditStreamEvent {
    eventType: string;
    actorUid: string;
    sessionId?: string;
    targetCollection?: string;
    targetDocumentId?: string;
    metadata?: Record<string, unknown>;
    occurredAt: number;
}
export declare const DEAD_LETTER_CATEGORY_AUDIT_STREAM = "audit_stream";
export declare const DEAD_LETTER_STATUS_FAILED = "failed_to_stream";
export declare const DEAD_LETTER_STATUS_STREAMED = "streamed";
/** Attempts to stream an audit event; throws on BigQuery failure (for callers that need to know). */
export declare function streamAuditEventOrThrow(event: AuditStreamEvent): Promise<void>;
export declare function streamAuditEvent(event: AuditStreamEvent): Promise<void>;
//# sourceMappingURL=audit-stream.d.ts.map