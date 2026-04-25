import { onSchedule } from 'firebase-functions/v2/scheduler'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('adminOperationsSweep')
const THIRTY_MIN_MS = 30 * 60 * 1000

export interface AdminOperationsSweepDeps {
  now: Timestamp
}

export async function adminOperationsSweepCore(
  db: FirebaseFirestore.Firestore,
  deps: AdminOperationsSweepDeps,
): Promise<void> {
  const nowMs = deps.now.toMillis()
  const cutoff = nowMs - THIRTY_MIN_MS

  // Agency assistance escalation: pending > 30min with no escalatedAt
  const pendingAssistance = await db
    .collection('agency_assistance_requests')
    .where('status', '==', 'pending')
    .where('createdAt', '<', cutoff)
    .where('escalatedAt', '==', null)
    .get()

  const toEscalate = pendingAssistance.docs
  const BATCH_SIZE = 50
  for (let i = 0; i < toEscalate.length; i += BATCH_SIZE) {
    const batch = toEscalate.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (d) => {
        const latest = await d.ref.get()
        const latestData = latest.data()
        if (latestData?.status === 'pending' && latestData.escalatedAt == null) {
          await d.ref.update({ escalatedAt: deps.now.toMillis() })
          log({
            severity: 'INFO',
            code: 'sweep.agency.escalated',
            message: `Escalated agency request ${d.id}`,
          })
        } else {
          log({
            severity: 'INFO',
            code: 'sweep.agency.skipped',
            message: `Skipped agency request ${d.id}: status=${String(latestData?.status)}, escalatedAt=${String(latestData?.escalatedAt)}`,
          })
        }
      }),
    )
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const doc = batch[idx]
        if (!doc) return
        log({
          severity: 'ERROR',
          code: 'sweep.agency.escalate_failed',
          message: `Failed to escalate agency request ${doc.id}: ${String(result.reason)}`,
          data: { docId: doc.id, error: String(result.reason) },
        })
      }
    })
  }

  // Shift handoff escalation: pending > 30min with no escalatedAt
  const pendingHandoffs = await db
    .collection('shift_handoffs')
    .where('status', '==', 'pending')
    .where('createdAt', '<', cutoff)
    .where('escalatedAt', '==', null)
    .get()

  const toEscalateHandoffs = pendingHandoffs.docs
  for (let i = 0; i < toEscalateHandoffs.length; i += BATCH_SIZE) {
    const batch = toEscalateHandoffs.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (d) => {
        const latest = await d.ref.get()
        const latestData = latest.data()
        if (latestData?.status === 'pending' && latestData.escalatedAt == null) {
          await d.ref.update({ escalatedAt: deps.now.toMillis() })
          log({
            severity: 'INFO',
            code: 'sweep.handoff.escalated',
            message: `Escalated handoff ${d.id}`,
          })
        } else {
          log({
            severity: 'INFO',
            code: 'sweep.handoff.skipped',
            message: `Skipped handoff ${d.id}: status=${String(latestData?.status)}, escalatedAt=${String(latestData?.escalatedAt)}`,
          })
        }
      }),
    )
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const doc = batch[idx]
        if (!doc) return
        log({
          severity: 'ERROR',
          code: 'sweep.handoff.escalate_failed',
          message: `Failed to escalate handoff ${doc.id}: ${String(result.reason)}`,
          data: { docId: doc.id, error: String(result.reason) },
        })
      }
    })
  }
}

export const adminOperationsSweep = onSchedule(
  { schedule: 'every 10 minutes', region: 'asia-southeast1', timeoutSeconds: 120 },
  async () => {
    try {
      await adminOperationsSweepCore(adminDb, { now: Timestamp.now() })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log({
        severity: 'ERROR',
        code: 'sweep.failed',
        message: `Admin operations sweep failed: ${message}`,
        data: { error: message },
      })
      throw err
    }
  },
)
