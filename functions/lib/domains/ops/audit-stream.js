/**
 * audit-stream.ts
 *
 * Fire-and-forget audit event streaming to BigQuery.
 * All PRE-7 callables call streamAuditEvent() — never throws.
 * Requires infra: bantayog_audit.streaming_events table — see infra/bigquery/
 */
import { BigQuery } from '@google-cloud/bigquery';
import { adminDb } from '../../admin-init.js';
export const DEAD_LETTER_CATEGORY_AUDIT_STREAM = 'audit_stream';
export const DEAD_LETTER_STATUS_FAILED = 'failed_to_stream';
export const DEAD_LETTER_STATUS_STREAMED = 'streamed';
const bq = new BigQuery();
const table = bq.dataset('bantayog_audit').table('streaming_events');
function shouldSkipExternalAuditStream() {
    return process.env.FUNCTIONS_EMULATOR === 'true';
}
/** Attempts to stream an audit event; throws on BigQuery failure (for callers that need to know). */
export async function streamAuditEventOrThrow(event) {
    if (shouldSkipExternalAuditStream())
        return;
    await table.insert([event]);
}
export async function streamAuditEvent(event) {
    if (shouldSkipExternalAuditStream())
        return;
    try {
        await streamAuditEventOrThrow(event);
    }
    catch (err) {
        console.warn('[audit-stream] failed to stream event', event.eventType, err);
        try {
            await adminDb.collection('dead_letters').add({
                category: DEAD_LETTER_CATEGORY_AUDIT_STREAM,
                status: DEAD_LETTER_STATUS_FAILED,
                payload: event,
                createdAt: Date.now(),
                error: err instanceof Error ? err.message : String(err),
            });
        }
        catch (dlErr) {
            console.error('[audit-stream] failed to write dead letter', dlErr);
        }
    }
}
//# sourceMappingURL=audit-stream.js.map