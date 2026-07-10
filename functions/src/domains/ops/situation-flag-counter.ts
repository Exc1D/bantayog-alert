import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import type { Firestore } from 'firebase-admin/firestore'
import { adminDb } from '../../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('situationFlagCounter')

export async function situationFlagCounterCore(db: Firestore, updateId: string): Promise<void> {
  const ref = db.collection('situation_updates').doc(updateId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) return
    const current: unknown = snap.data()?.reportedCount
    // Concrete read-then-write instead of FieldValue.increment — Admin
    // transforms break under @firebase/rules-unit-testing client contexts.
    const count = typeof current === 'number' && Number.isFinite(current) ? current : 0
    tx.update(ref, { reportedCount: count + 1 })
  })
}

export const situationFlagCounter = onDocumentCreated(
  { document: 'situation_updates/{updateId}/reports/{reportId}', region: 'asia-southeast1' },
  async (event) => {
    try {
      await situationFlagCounterCore(adminDb, event.params.updateId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log({
        severity: 'ERROR',
        code: 'situation.flag_counter_failed',
        message: `Flag counter failed for ${event.params.updateId}: ${message}`,
        data: { updateId: event.params.updateId, error: message },
      })
      throw err
    }
  },
)
