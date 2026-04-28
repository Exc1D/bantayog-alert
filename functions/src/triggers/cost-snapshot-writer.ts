import { onSchedule } from 'firebase-functions/v2/scheduler'
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore'
import { BigQuery } from '@google-cloud/bigquery'

const bq = new BigQuery()

const TODAY_COST_SQL =
  'SELECT IFNULL(SUM(cost), 0) AS totalCost FROM `cloud_billing_export.gcp_billing_export_v1_*` WHERE DATE(usage_start_time) = CURRENT_DATE()'
const BASELINE_COST_SQL =
  'SELECT IFNULL(AVG(dailyCost), 0) AS totalCost FROM (SELECT SUM(cost) AS dailyCost FROM `cloud_billing_export.gcp_billing_export_v1_*` WHERE DATE(usage_start_time) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) GROUP BY DATE(usage_start_time))'

interface CostRow {
  totalCost?: number | string
}

function extractCost(rows: readonly unknown[]): number {
  const row = rows[0]
  if (!row || typeof row !== 'object') return 0
  const value = (row as CostRow).totalCost
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export interface CostSnapshotWriterDeps {
  now?: () => number
}

/**
 * Writes a daily cost snapshot to `system_health/latest` in Firestore.
 * Queries BigQuery for today's spend and a 7-day baseline average (including zero-cost days),
 * then flags anomalies where today's cost exceeds 1.5x the baseline.
 *
 * @param db - Firestore instance
 * @param bigQuery - BigQuery client (injectable for testing)
 * @param deps - Optional dependencies (now override)
 * @returns Object with anomaly flag, today's cost, and baseline cost
 */
export async function costSnapshotWriterCore(
  db: Firestore,
  bigQuery: Pick<BigQuery, 'query'>,
  deps: CostSnapshotWriterDeps = {},
): Promise<{ anomaly: boolean; todayCost: number; baselineCost: number }> {
  const now = deps.now ?? (() => Date.now())

  const [todayRows] = await bigQuery.query(TODAY_COST_SQL)
  const [baselineRows] = await bigQuery.query(BASELINE_COST_SQL)

  const todayCost = extractCost(todayRows)
  const baselineCost = extractCost(baselineRows)
  const anomaly = baselineCost > 0 && todayCost >= baselineCost * 1.5

  await db.doc('system_health/latest').set(
    {
      costSnapshot: {
        todayCost,
        baselineCost,
        anomaly,
        recordedAt: now(),
      },
      checkedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return { anomaly, todayCost, baselineCost }
}

export const costSnapshotWriter = onSchedule(
  { schedule: '15 0 * * *', region: 'asia-southeast1', timeoutSeconds: 300, timeZone: 'UTC' },
  async () => {
    await costSnapshotWriterCore(getFirestore(), bq)
  },
)
