import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore } from 'firebase-admin/firestore';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('cleanupSmsMinuteWindows');
const RETENTION_MS = 60 * 60 * 1000;
const PROVIDERS = ['semaphore', 'globelabs'];
const BATCH_SIZE = 400;
export async function cleanupSmsMinuteWindowsCore({ db, now }) {
    const nowMs = now();
    const threshold = nowMs - RETENTION_MS;
    let totalDeleted = 0;
    for (const providerId of PROVIDERS) {
        let lastDocId;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
            let q = db
                .collection('sms_provider_health')
                .doc(providerId)
                .collection('minute_windows')
                .where('windowStartMs', '<', threshold)
                .orderBy('windowStartMs', 'asc')
                .limit(BATCH_SIZE);
            if (lastDocId) {
                const lastSnap = await db
                    .collection('sms_provider_health')
                    .doc(providerId)
                    .collection('minute_windows')
                    .doc(lastDocId)
                    .get();
                q = q.startAfter(lastSnap);
            }
            const snap = await q.get();
            if (snap.empty)
                break;
            const batch = db.batch();
            for (const doc of snap.docs) {
                batch.delete(doc.ref);
            }
            await batch.commit();
            totalDeleted += snap.size;
            if (snap.size < BATCH_SIZE)
                break;
            const lastDoc = snap.docs[snap.docs.length - 1];
            lastDocId = lastDoc ? lastDoc.id : undefined;
        }
    }
    log({
        severity: 'INFO',
        code: 'sms.minute_windows.cleaned',
        message: `cleaned ${String(totalDeleted)} windows`,
        data: { totalDeleted },
    });
}
export const cleanupSmsMinuteWindows = onSchedule({ schedule: 'every 60 minutes', region: 'asia-southeast1', timeoutSeconds: 540 }, async () => {
    await cleanupSmsMinuteWindowsCore({ db: getFirestore(), now: () => Date.now() });
});
//# sourceMappingURL=cleanup-sms-minute-windows.js.map