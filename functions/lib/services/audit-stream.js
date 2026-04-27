/**
 * audit-stream.ts
 *
 * Fire-and-forget audit event streaming to BigQuery.
 * All PRE-7 callables call streamAuditEvent() — never throws.
 * Requires infra: bantayog_audit.streaming_events table — see infra/bigquery/
 */
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery();
const table = bq.dataset('bantayog_audit').table('streaming_events');
export async function streamAuditEvent(event) {
    try {
        await table.insert([event]);
    }
    catch (err) {
        console.warn('[audit-stream] failed to stream event', event.eventType, err);
    }
}
//# sourceMappingURL=audit-stream.js.map