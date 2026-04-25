import { onSchedule } from 'firebase-functions/v2/scheduler'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { CAMARINES_NORTE_MUNICIPALITY_IDS } from '@bantayog/shared-data'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('analyticsSnapshotWriter')

const REPORT_STATUSES = [
  'draft_inbox',
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'closed',
  'reopened',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
] as const

const SEVERITIES = ['low', 'medium', 'high'] as const

export interface AnalyticsSnapshotDeps {
  date: string
  now: number | Timestamp
}

export async function analyticsSnapshotWriterCore(
  db: FirebaseFirestore.Firestore,
  deps: AnalyticsSnapshotDeps,
): Promise<void> {
  const { date, now } = deps
  const nowMillis = typeof now === 'number' ? now : now.toMillis()

  const provinceByStatus: Record<string, number> = {}
  const provinceBySeverity: Record<string, number> = {}

  for (const municipalityId of CAMARINES_NORTE_MUNICIPALITY_IDS) {
    const reportsByStatus: Record<string, number> = {}
    const reportsBySeverity: Record<string, number> = {}

    await Promise.all([
      ...REPORT_STATUSES.map(async (status) => {
        const snap = await db
          .collection('report_ops')
          .where('municipalityId', '==', municipalityId)
          .where('status', '==', status)
          .count()
          .get()
        reportsByStatus[status] = snap.data().count
        provinceByStatus[status] = (provinceByStatus[status] ?? 0) + snap.data().count
      }),
      ...SEVERITIES.map(async (severity) => {
        const snap = await db
          .collection('report_ops')
          .where('municipalityId', '==', municipalityId)
          .where('severity', '==', severity)
          .count()
          .get()
        reportsBySeverity[severity] = snap.data().count
        provinceBySeverity[severity] = (provinceBySeverity[severity] ?? 0) + snap.data().count
      }),
    ])

    await db
      .collection('analytics_snapshots')
      .doc(date)
      .collection(municipalityId)
      .doc('summary')
      .set({
        date,
        municipalityId,
        reportsByStatus,
        reportsBySeverity,
        generatedAt: nowMillis,
        schemaVersion: 1,
      })
  }

  await db.collection('analytics_snapshots').doc(date).collection('province').doc('summary').set({
    date,
    municipalityId: 'province',
    reportsByStatus: provinceByStatus,
    reportsBySeverity: provinceBySeverity,
    generatedAt: nowMillis,
    schemaVersion: 1,
  })

  log({
    severity: 'INFO',
    code: 'analytics.done',
    message: `Analytics snapshot written for ${date}`,
  })
}

export const analyticsSnapshotWriter = onSchedule(
  { schedule: '5 0 * * *', region: 'asia-southeast1', timeoutSeconds: 300, timeZone: 'UTC' },
  async () => {
    const now = Timestamp.now()
    const date = new Date(now.toMillis()).toISOString().slice(0, 10)
    await analyticsSnapshotWriterCore(adminDb, { date, now })
  },
)
