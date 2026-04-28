import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { replayHazardSignalProjection } from '../services/hazard-signal-projector.js'

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

  for (const signalDoc of snap.docs) {
    await signalDoc.ref.update({ status: 'expired' })
  }

  await replayHazardSignalProjection({ db: input.db, now })

  return { expired: snap.docs.length }
}

export const hazardSignalExpirySweep = onSchedule(
  { schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' },
  async () => {
    await hazardSignalExpirySweepCore({ db: getFirestore() })
  },
)
