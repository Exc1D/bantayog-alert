import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'
import { BigQuery } from '@google-cloud/bigquery'

const bq = new BigQuery()

interface LastAtRow {
  lastAt: { value: string }
}

function isLastAtRow(row: unknown): row is LastAtRow {
  if (typeof row !== 'object' || row === null) return false
  const candidate = row as Record<string, unknown>
  const lastAt = candidate.lastAt
  if (typeof lastAt !== 'object' || lastAt === null) return false
  const lastAtRecord = lastAt as Record<string, unknown>
  return typeof lastAtRecord.value === 'string'
}

function extractTimestampMs(rows: readonly unknown[]): number {
  const row = rows[0]
  if (!isLastAtRow(row)) return 0
  const numeric = Number(row.lastAt.value)
  if (!Number.isNaN(numeric)) return numeric
  const dateMs = new Date(row.lastAt.value).getTime()
  return Number.isNaN(dateMs) ? 0 : dateMs
}

export interface AuditExportHealthCheckResult {
  streamingGapSeconds: number
  batchGapSeconds: number
  healthy: boolean
}

export async function auditExportHealthCheckCore(
  db: Firestore,
  messaging: Messaging,
  opts: {
    query: (sql: string, options: { timeoutMs: number }) => Promise<[unknown[], ...unknown[]]>
    now: () => number
  },
): Promise<AuditExportHealthCheckResult> {
  const now = opts.now()

  const [streamRows] = await opts.query(
    'SELECT MAX(occurredAt) as lastAt FROM bantayog_audit.streaming_events',
    { timeoutMs: 30000 },
  )
  const lastStreamMs = extractTimestampMs(streamRows)
  const streamingGapSeconds = Math.floor((now - lastStreamMs) / 1000)

  const [batchRows] = await opts.query(
    'SELECT MAX(timestamp) as lastAt FROM bantayog_audit.batch_events',
    { timeoutMs: 30000 },
  )
  const lastBatchMs = extractTimestampMs(batchRows)
  const batchGapSeconds = Math.floor((now - lastBatchMs) / 1000)

  const healthy = streamingGapSeconds < 60 && batchGapSeconds < 900
  await db.doc('system_health/latest').set({
    streamingGapSeconds,
    batchGapSeconds,
    healthy,
    checkedAt: FieldValue.serverTimestamp(),
  })

  if (!healthy) {
    try {
      await messaging.send({
        topic: 'superadmin-alerts',
        notification: {
          title: 'Audit pipeline health alert',
          body: `Streaming gap: ${String(streamingGapSeconds)}s · Batch gap: ${String(batchGapSeconds)}s`,
        },
      })
    } catch (err: unknown) {
      console.error('[audit-export-health-check] failed to send FCM alert', {
        streamingGapSeconds,
        batchGapSeconds,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { streamingGapSeconds, batchGapSeconds, healthy }
}

export const auditExportHealthCheck = onSchedule(
  { schedule: 'every 10 minutes', region: 'asia-southeast1', timeZone: 'UTC' },
  async () => {
    await auditExportHealthCheckCore(getFirestore(), getMessaging(), {
      query: (sql, options) => bq.query(sql, options),
      now: () => Date.now(),
    })
  },
)
