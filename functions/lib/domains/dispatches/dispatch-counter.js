import { adminDb } from '../../admin-init.js';
import { FieldValue } from 'firebase-admin/firestore';
export async function incrementDispatchCounter(scopeType, scopeId, metric, value = 1) {
    const date = new Date().toISOString().slice(0, 10);
    const docId = scopeType === 'province' ? `province_${date}` : `${scopeId}_${date}`;
    const ref = adminDb.collection('metrics_daily').doc(docId);
    await ref.set({
        scopeType,
        scopeId,
        date,
        [metric]: FieldValue.increment(value),
        updatedAt: Date.now(),
    }, { merge: true });
}
//# sourceMappingURL=dispatch-counter.js.map