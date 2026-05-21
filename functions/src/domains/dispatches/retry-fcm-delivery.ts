import { onSchedule } from 'firebase-functions/v2/scheduler'
import { adminDb } from '../../admin-init.js'
import { sendFcmToResponder } from '../ops/fcm-send.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('retryFcmDelivery')

const MAX_RETRY_ATTEMPTS = 3
const BACKOFF_SCHEDULE_MS = [30_000, 60_000, 120_000] as const
const DEFAULT_BACKOFF_MS = 120_000
const BATCH_LIMIT = 50
const STALE_IN_PROGRESS_MS = 5 * 60 * 1000 // 5 minutes

interface RetryQueueDoc {
  dispatchId: string
  responderUid: string
  attemptCount: number
  originalError: string
  lastAttemptAt?: number
}

export const retryFcmDelivery = onSchedule(
  {
    schedule: 'every 30 seconds',
    region: 'asia-southeast1',
    minInstances: 1,
    maxInstances: 1,
    timeoutSeconds: 120,
  },
  async () => {
    const now = Date.now()
    const snap = await adminDb
      .collection('fcm_retry_queue')
      .where('status', '==', 'pending')
      .where('nextAttemptAt', '<=', now)
      .limit(BATCH_LIMIT)
      .get()

    // Stale recovery: reset docs stuck in 'in_progress' for too long
    const staleSnap = await adminDb
      .collection('fcm_retry_queue')
      .where('status', '==', 'in_progress')
      .where('lastAttemptAt', '<', now - STALE_IN_PROGRESS_MS)
      .limit(BATCH_LIMIT)
      .get()

    for (const staleDoc of staleSnap.docs) {
      await staleDoc.ref.update({ status: 'pending' })
    }

    for (const doc of snap.docs) {
      const data = doc.data() as RetryQueueDoc

      if (data.attemptCount >= MAX_RETRY_ATTEMPTS) {
        await doc.ref.update({ status: 'permanent_failure' })
        log({
          severity: 'ERROR',
          code: 'fcm.permanent_failure',
          message: `FCM permanent failure for dispatch ${data.dispatchId}`,
        })
        continue
      }

      await doc.ref.update({ status: 'in_progress', lastAttemptAt: now })

      try {
        const result = await sendFcmToResponder({
          uid: data.responderUid,
          title: 'New dispatch (retry)',
          body: `Report ${data.dispatchId.slice(0, 8)}`,
          data: { dispatchId: data.dispatchId },
        })

        if (result.warnings.includes('fcm_network_error')) {
          const backoffMs = BACKOFF_SCHEDULE_MS[data.attemptCount] ?? DEFAULT_BACKOFF_MS
          await doc.ref.update({
            status: 'pending',
            attemptCount: data.attemptCount + 1,
            lastAttemptAt: now,
            nextAttemptAt: now + backoffMs,
          })
        } else {
          await doc.ref.update({ status: 'success' })
        }
      } catch {
        await doc.ref.update({ status: 'permanent_failure' })
      }
    }
  },
)
