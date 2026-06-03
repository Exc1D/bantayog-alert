import { onSchedule } from 'firebase-functions/v2/scheduler'
import { BigQuery } from '@google-cloud/bigquery'

const bq = new BigQuery()

export async function auditExportBatchCore(opts: {
  bqTable: { insert(rows: unknown[]): Promise<unknown> }
  loggingLog: {
    getEntries(options: {
      pageSize: number
      filter?: string
      autoPaginate?: boolean
    }): Promise<[unknown[], ...unknown[]]>
  }
  now?: () => number
}): Promise<{ exported: number }> {
  const now = opts.now ? opts.now() : Date.now()
  const sixMinutesAgo = new Date(now - 6 * 60 * 1000).toISOString()
  const [entries] = await opts.loggingLog.getEntries({
    pageSize: 500,
    autoPaginate: true,
    filter: `timestamp >= "${sixMinutesAgo}"`,
  })
  if (entries.length === 0) return { exported: 0 }
  interface LogEntry {
    metadata?: {
      insertId?: string
      logName?: unknown
      resource?: unknown
      timestamp?: string
    }
    data?: unknown
  }
  const rows = (entries as LogEntry[]).map((e, i) => ({
    insertId: e.metadata?.insertId ?? `${e.metadata?.timestamp ?? String(Date.now())}-${String(i)}`,
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
    const { Logging } = await import('@google-cloud/logging')
    const logging = new Logging()
    const table = bq.dataset('bantayog_audit').table('batch_events')
    const log = logging.log('cloudaudit.googleapis.com%2Factivity')
    await auditExportBatchCore({ bqTable: table, loggingLog: log })
  },
)
