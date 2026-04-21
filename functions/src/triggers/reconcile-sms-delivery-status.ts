import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('reconcileSmsDeliveryStatus')
const ORPHAN_THRESHOLD_MS = 30 * 60 * 1000
const DEFERRED_PICKUP_LIMIT = 100

export interface ReconcileArgs {
  db: Firestore
  now: () => number
}

export async function reconcileSmsDeliveryStatusCore({ db, now }: ReconcileArgs): Promise<void> {
  const nowMs = now()

  // Orphan sweep.
  const orphansSnap = await db
    .collection('sms_outbox')
    .where('status', '==', 'queued')
    .where('queuedAt', '<', nowMs - ORPHAN_THRESHOLD_MS)
    .limit(500)
    .get()

  for (const doc of orphansSnap.docs) {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref)
      const data = snap.data() as { status?: string; queuedAt?: number }
      if (data.status !== 'queued') return
      tx.update(doc.ref, { status: 'abandoned', abandonedAt: nowMs, terminalReason: 'orphan' })
      log({ severity: 'INFO', code: 'sms.abandoned.orphan', message: doc.id })
    })
  }

  // Deferred pickup.
  const deferredSnap = await db
    .collection('sms_outbox')
    .where('status', '==', 'deferred')
    .limit(DEFERRED_PICKUP_LIMIT)
    .get()

  for (const doc of deferredSnap.docs) {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref)
      const data = snap.data() as { status?: string } | undefined
      if (data?.status !== 'deferred') return
      tx.update(doc.ref, { status: 'queued', queuedAt: nowMs })
    })
  }

  log({
    severity: 'INFO',
    code: 'sms.reconcile.completed',
    message: 'reconcile tick',
    data: { orphansAbandoned: orphansSnap.size, deferredPickedUp: deferredSnap.size },
  })
}

export const reconcileSmsDeliveryStatus = onSchedule(
  { schedule: 'every 10 minutes', region: 'asia-southeast1', timeoutSeconds: 120 },
  async () => {
    await reconcileSmsDeliveryStatusCore({ db: getFirestore(), now: () => Date.now() })
  },
)
