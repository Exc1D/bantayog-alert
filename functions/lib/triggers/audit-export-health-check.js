import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { BigQuery } from '@google-cloud/bigquery';
const bq = new BigQuery();
function extractLastMs(rows) {
    const row = rows[0];
    if (!row?.lastAt?.value)
        return 0;
    return Number(row.lastAt.value);
}
function extractLastDateMs(rows) {
    const row = rows[0];
    if (!row?.lastAt?.value)
        return 0;
    return new Date(row.lastAt.value).getTime();
}
export const auditExportHealthCheck = onSchedule({ schedule: 'every 10 minutes', region: 'asia-southeast1', timeZone: 'UTC' }, async () => {
    const db = getFirestore();
    const now = Date.now();
    const [streamRows] = await bq.query('SELECT MAX(occurredAt) as lastAt FROM bantayog_audit.streaming_events');
    const lastStreamMs = extractLastMs(streamRows);
    const streamingGapSeconds = Math.floor((now - lastStreamMs) / 1000);
    const [batchRows] = await bq.query('SELECT MAX(timestamp) as lastAt FROM bantayog_audit.batch_events');
    const lastBatchMs = extractLastDateMs(batchRows);
    const batchGapSeconds = Math.floor((now - lastBatchMs) / 1000);
    const healthy = streamingGapSeconds < 60 && batchGapSeconds < 900;
    await db.doc('system_health/latest').set({
        streamingGapSeconds,
        batchGapSeconds,
        healthy,
        checkedAt: FieldValue.serverTimestamp(),
    });
    if (!healthy) {
        try {
            await getMessaging().send({
                topic: 'superadmin-alerts',
                notification: {
                    title: 'Audit pipeline health alert',
                    body: `Streaming gap: ${String(streamingGapSeconds)}s · Batch gap: ${String(batchGapSeconds)}s`,
                },
            });
        }
        catch {
            /* non-critical */
        }
    }
});
//# sourceMappingURL=audit-export-health-check.js.map