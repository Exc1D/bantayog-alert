import { adminDb } from '../../admin-init.js'
import { FieldValue } from 'firebase-admin/firestore'

export async function incrementDispatchCounter(
  scopeType: 'municipality' | 'agency' | 'province',
  scopeId: string,
  metric:
    | 'totalDispatches'
    | 'acceptedCount'
    | 'declinedCount'
    | 'escalatedCount'
    | 'needsAdminCount'
    | 'fcmSuccessCount'
    | 'fcmFailureCount',
  value = 1,
): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  const docId = scopeType === 'province' ? `province_${date}` : `${scopeId}_${date}`
  const ref = adminDb.collection('metrics_daily').doc(docId)
  await ref.set(
    {
      scopeType,
      scopeId,
      date,
      [metric]: FieldValue.increment(value),
      updatedAt: Date.now(),
    },
    { merge: true },
  )
}
