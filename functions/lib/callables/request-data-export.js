import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth } from './https-error.js';
export const requestDataExport = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    const { uid } = requireAuth(request, ['citizen']);
    const db = getFirestore();
    const jobRef = await db.collection('data_exports').add({
        uid,
        status: 'queued',
        requestedAt: Date.now(),
    });
    logger.info(`Data export requested by ${uid}, job ${jobRef.id}`);
    return { status: 'queued', jobId: jobRef.id };
});
//# sourceMappingURL=request-data-export.js.map