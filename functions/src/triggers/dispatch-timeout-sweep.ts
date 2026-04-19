import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('dispatchTimeoutSweep')

export const dispatchTimeoutSweep = onSchedule(
  { schedule: 'every 1 minutes', region: 'asia-southeast1', timeoutSeconds: 60, maxInstances: 1 },
  async () => {
    const db = getFirestore()
    const now = Timestamp.now()

    // We fetch pending dispatches and filter in memory to avoid requiring a composite index
    // specifically for (status, acknowledgementDeadlineAt) if not strictly needed, or we can use it if indexed.
    // In practice, 'pending' dispatches at any given moment are a very small set.
    const snap = await db.collection('dispatches').where('status', '==', 'pending').get()

    let timedOutCount = 0
    const batch = db.batch()

    for (const doc of snap.docs) {
      const d = doc.data()
      const deadline = d.acknowledgementDeadlineAt as Timestamp | undefined

      if (deadline && deadline.toMillis() <= now.toMillis()) {
        batch.update(doc.ref, {
          status: 'timed_out',
          lastStatusAt: now,
          timeoutReason: 'deadline_exceeded',
        })

        const evRef = db.collection('dispatch_events').doc()
        const correlationId = crypto.randomUUID()
        batch.set(evRef, {
          eventId: evRef.id,
          dispatchId: doc.id,
          reportId: d.reportId,
          from: 'pending',
          to: 'timed_out',
          actor: 'system:timeoutSweep',
          actorRole: 'system',
          at: now,
          correlationId,
          schemaVersion: 1,
        })
        timedOutCount++
      }
    }

    if (timedOutCount > 0) {
      await batch.commit()
      log({
        severity: 'INFO',
        code: 'DISPATCH_TIMEOUT_SWEEP',
        message: `Timed out ${String(timedOutCount)} pending dispatches`,
        data: { timedOutCount },
      })
    }
  },
)
