import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { replayHazardSignalProjection } from '../services/hazard-signal-projector.js'

/**
 * Sweeps expired hazard signals and marks them as expired.
 * Queries all active signals whose validUntil has passed, marks each as expired
 * (with error handling per-signal), and replays the projection if any signals were expired.
 *
 * @param input - Firestore instance and optional now() override
 * @returns Count of signals successfully expired
 */
export async function hazardSignalExpirySweepCore(input: {
  db: Firestore
  now?: () => number
}): Promise<{ expired: number }> {
  const now = input.now ? input.now() : Date.now()

  const snap = await input.db
    .collection('hazard_signals')
    .where('status', '==', 'active')
    .where('validUntil', '<=', now)
    .get()

  let expired = 0
  for (const signalDoc of snap.docs) {
    try {
      await signalDoc.ref.update({ status: 'expired' })
      expired++
    } catch (err) {
      console.error('Failed to expire signal', signalDoc.id, err)
    }
  }

  if (expired > 0) {
    await replayHazardSignalProjection({ db: input.db, now })
  }

  return { expired }
}

export const hazardSignalExpirySweep = onSchedule(
  { schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' },
  async () => {
    await hazardSignalExpirySweepCore({ db: getFirestore() })
  },
)
