import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../admin-init.js';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('adminOperationsSweep');
const THIRTY_MIN_MS = 30 * 60 * 1000;
export async function adminOperationsSweepCore(db, deps) {
    const nowMs = deps.now.toMillis();
    const cutoff = nowMs - THIRTY_MIN_MS;
    // Agency assistance escalation: pending > 30min with no escalatedAt
    const pendingAssistance = await db
        .collection('agency_assistance_requests')
        .where('status', '==', 'pending')
        .where('createdAt', '<', cutoff)
        .where('escalatedAt', '==', null)
        .get();
    const toEscalate = pendingAssistance.docs;
    const BATCH_SIZE = 50;
    for (let i = 0; i < toEscalate.length; i += BATCH_SIZE) {
        const batch = toEscalate.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (d) => {
            await d.ref.update({ escalatedAt: deps.now.toMillis() });
            log({
                severity: 'INFO',
                code: 'sweep.agency.escalated',
                message: `Escalated agency request ${d.id}`,
            });
        }));
    }
}
export const adminOperationsSweep = onSchedule({ schedule: 'every 10 minutes', region: 'asia-southeast1', timeoutSeconds: 120 }, async () => {
    await adminOperationsSweepCore(adminDb, { now: Timestamp.now() });
});
//# sourceMappingURL=admin-operations-sweep.js.map