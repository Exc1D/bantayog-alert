import { onSchedule } from 'firebase-functions/v2/scheduler';
import { BigQuery } from '@google-cloud/bigquery';
import { Logging } from '@google-cloud/logging';
const bq = new BigQuery();
const logging = new Logging();
export const auditExportBatch = onSchedule({ schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' }, async () => {
    const table = bq.dataset('bantayog_audit').table('batch_events');
    const log = logging.log('cloudaudit.googleapis.com%2Factivity');
    const [entries] = await log.getEntries({ pageSize: 500 });
    if (entries.length === 0)
        return;
    const rows = entries.map((e) => ({
        logName: e.metadata.logName,
        resource: JSON.stringify(e.metadata.resource),
        payload: JSON.stringify(e.data),
        timestamp: e.metadata.timestamp,
    }));
    try {
        await table.insert(rows);
    }
    catch (err) {
        console.warn('[audit-export-batch] insert failed', err);
    }
});
//# sourceMappingURL=audit-export-batch.js.map