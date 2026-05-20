import { onSchedule } from 'firebase-functions/v2/scheduler';
import { adminDb } from '../admin-init.js';
import { sendFcmToResponder } from '../services/fcm-send.js';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('retryFcmDelivery');
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_SCHEDULE_MS = [30_000, 60_000, 120_000];
const DEFAULT_BACKOFF_MS = 120_000;
const BATCH_LIMIT = 50;
export const retryFcmDelivery = onSchedule({
    schedule: 'every 30 seconds',
    region: 'asia-southeast1',
    minInstances: 1,
    maxInstances: 1,
    timeoutSeconds: 120,
}, async () => {
    const now = Date.now();
    const snap = await adminDb
        .collection('fcm_retry_queue')
        .where('status', '==', 'pending')
        .where('nextAttemptAt', '<=', now)
        .limit(BATCH_LIMIT)
        .get();
    for (const doc of snap.docs) {
        const data = doc.data();
        if (data.attemptCount >= MAX_RETRY_ATTEMPTS) {
            await doc.ref.update({ status: 'permanent_failure' });
            log({
                severity: 'ERROR',
                code: 'fcm.permanent_failure',
                message: `FCM permanent failure for dispatch ${data.dispatchId}`,
            });
            continue;
        }
        await doc.ref.update({ status: 'in_progress' });
        try {
            const result = await sendFcmToResponder({
                uid: data.responderUid,
                title: 'New dispatch (retry)',
                body: `Report ${data.dispatchId.slice(0, 8)}`,
                data: { dispatchId: data.dispatchId },
            });
            if (result.warnings.includes('fcm_network_error')) {
                const backoffMs = BACKOFF_SCHEDULE_MS[data.attemptCount] ?? DEFAULT_BACKOFF_MS;
                await doc.ref.update({
                    status: 'pending',
                    attemptCount: data.attemptCount + 1,
                    lastAttemptAt: now,
                    nextAttemptAt: now + backoffMs,
                });
            }
            else {
                await doc.ref.update({ status: 'success' });
            }
        }
        catch {
            await doc.ref.update({ status: 'permanent_failure' });
        }
    }
});
//# sourceMappingURL=retry-fcm-delivery.js.map