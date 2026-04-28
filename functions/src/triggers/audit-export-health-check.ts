import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
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

// extractLastMs expects INT64 epoch (numeric)
function extractLastMs(rows: readonly unknown[]): number {
  const row = rows[0]
  if (!isLastAtRow(row)) return 0
  const ms = Number(row.lastAt.value)
  return Number.isNaN(ms) ? 0 : ms
}

// extractLastDateMs expects timestamp string (from batch_events.timestamp column)
function extractLastDateMs(rows: readonly unknown[]): number {
  const row = rows[0]
  if (!isLastAtRow(row)) return 0
  const ms = new Date(row.lastAt.value).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

export const auditExportHealthCheck = onSchedule(
  { schedule: 'every 10 minutes', region: 'asia-southeast1', timeZone: 'UTC' },
  async () => {
    const db = getFirestore()
    const now = Date.now()

    const [streamRows] = await bq.query(
      'SELECT MAX(occurredAt) as lastAt FROM bantayog_audit.streaming_events',
      { timeoutMs: 30000 },
    )
    const lastStreamMs = extractLastMs(streamRows)
    const streamingGapSeconds = Math.floor((now - lastStreamMs) / 1000)

    const [batchRows] = await bq.query(
      'SELECT MAX(timestamp) as lastAt FROM bantayog_audit.batch_events',
      { timeoutMs: 30000 },
    )
    const lastBatchMs = extractLastDateMs(batchRows)
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
        await getMessaging().send({
          topic: 'superadmin-alerts',
          notification: {
            title: 'Audit pipeline health alert',
            body: `Streaming gap: ${String(streamingGapSeconds)}s · Batch gap: ${String(batchGapSeconds)}s`,
          },
        })
      } catch (err) {
        console.error('[audit-export-health-check] failed to send FCM alert', {
          streamingGapSeconds,
          batchGapSeconds,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  },
)
