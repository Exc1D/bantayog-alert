import { onSchedule } from 'firebase-functions/v2/scheduler'
import { BigQuery } from '@google-cloud/bigquery'
import { Logging } from '@google-cloud/logging'

const bq = new BigQuery()
const logging = new Logging()

export async function auditExportBatchCore(opts: {
  bqTable: { insert(rows: unknown[]): Promise<unknown> }
  loggingLog: { getEntries(options: { pageSize: number }): Promise<[unknown[], ...unknown[]]> }
}): Promise<{ exported: number }> {
  const [entries] = await opts.loggingLog.getEntries({ pageSize: 500 })
  if (entries.length === 0) return { exported: 0 }
  interface LogEntry {
    metadata?: { logName?: unknown; resource?: unknown; timestamp?: unknown }
    data?: unknown
  }
  const rows = (entries as LogEntry[]).map((e) => ({
    logName: e.metadata?.logName,
    resource: JSON.stringify(e.metadata?.resource),
    payload: JSON.stringify(e.data),
    timestamp: e.metadata?.timestamp,
  }))
  try {
    await opts.bqTable.insert(rows)
  } catch (err: unknown) {
    console.warn('[audit-export-batch] insert failed', err)
    throw err instanceof Error
      ? new Error(`BigQuery insert failed: ${err.message}`)
      : new Error('BigQuery insert failed')
  }
  return { exported: rows.length }
}

export const auditExportBatch = onSchedule(
  { schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' },
  async () => {
    const table = bq.dataset('bantayog_audit').table('batch_events')
    const log = logging.log('cloudaudit.googleapis.com%2Factivity')
    await auditExportBatchCore({ bqTable: table, loggingLog: log })
  },
)
