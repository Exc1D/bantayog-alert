import { onSchedule } from 'firebase-functions/v2/scheduler';
import { BigQuery } from '@google-cloud/bigquery';
import { Logging } from '@google-cloud/logging';
const bq = new BigQuery();
const logging = new Logging();
export async function auditExportBatchCore(opts) {
    const now = opts.now ? opts.now() : Date.now();
    const sixMinutesAgo = new Date(now - 6 * 60 * 1000).toISOString();
    const [entries] = await opts.loggingLog.getEntries({
        pageSize: 500,
        filter: `timestamp >= "${sixMinutesAgo}"`,
    });
    if (entries.length === 0)
        return { exported: 0 };
    const rows = entries.map((e, i) => ({
        insertId: e.metadata?.insertId || `${e.metadata?.timestamp}-${i}`,
        logName: e.metadata?.logName,
        resource: JSON.stringify(e.metadata?.resource),
        payload: JSON.stringify(e.data),
        timestamp: e.metadata?.timestamp,
    }));
    try {
        await opts.bqTable.insert(rows);
    }
    catch (err) {
        console.warn('[audit-export-batch] insert failed', err);
        throw err instanceof Error
            ? new Error(`BigQuery insert failed: ${err.message}`)
            : new Error('BigQuery insert failed');
    }
    return { exported: rows.length };
}
export const auditExportBatch = onSchedule({ schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' }, async () => {
    const table = bq.dataset('bantayog_audit').table('batch_events');
    const log = logging.log('cloudaudit.googleapis.com%2Factivity');
    await auditExportBatchCore({ bqTable: table, loggingLog: log });
});
//# sourceMappingURL=audit-export-batch.js.map