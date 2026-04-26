import { getMessaging } from 'firebase-admin/messaging';
import { FieldValue } from 'firebase-admin/firestore';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('fcmMassSend');
const TOKEN_BATCH_SIZE = 500;
const MAX_BATCHES = 10;
function normalizeFcmTokens(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((t) => typeof t === 'string' && t.length > 0);
}
/**
 * Send a mass FCM notification to all responders with hasFcmToken == true
 * within a given set of municipality IDs.
 *
 * Batches tokens in groups of 500 (Firebase sendEachForMulticast limit).
 * Hard cap: 10 batches = 5000 tokens maximum per call.
 */
export async function sendMassAlertFcm(db, opts) {
    if (opts.municipalityIds.length === 0) {
        return { successCount: 0, failureCount: 0, batchCount: 0 };
    }
    // Firestore 'in' query supports max 10 values; chunk and merge.
    // Map token → owning responder doc IDs so invalid tokens can be cleaned up after send.
    const IN_QUERY_LIMIT = 10;
    const tokenOwners = new Map();
    for (let i = 0; i < opts.municipalityIds.length; i += IN_QUERY_LIMIT) {
        const chunk = opts.municipalityIds.slice(i, i + IN_QUERY_LIMIT);
        const snaps = await db
            .collection('responders')
            .where('isActive', '==', true)
            .where('hasFcmToken', '==', true)
            .where('municipalityId', 'in', chunk)
            .get();
        for (const respDoc of snaps.docs) {
            const tokens = normalizeFcmTokens(respDoc.data().fcmTokens);
            if (tokens.length === 0)
                continue;
            for (const token of tokens) {
                const owners = tokenOwners.get(token) ?? [];
                owners.push(respDoc.id);
                tokenOwners.set(token, owners);
            }
        }
    }
    const allTokens = [...tokenOwners.keys()];
    if (allTokens.length === 0)
        return { successCount: 0, failureCount: 0, batchCount: 0 };
    const hardCap = TOKEN_BATCH_SIZE * MAX_BATCHES;
    if (allTokens.length > hardCap) {
        log({
            severity: 'ERROR',
            code: 'fcm.mass.too_many_tokens',
            message: `Refusing partial mass send: ${String(allTokens.length)} tokens exceeds hard cap ${String(hardCap)}`,
        });
        return { successCount: 0, failureCount: allTokens.length, batchCount: 0 };
    }
    const messaging = getMessaging();
    let successCount = 0;
    let failureCount = 0;
    let batchCount = 0;
    const invalidTokens = [];
    for (let i = 0; i < allTokens.length; i += TOKEN_BATCH_SIZE) {
        const batch = allTokens.slice(i, i + TOKEN_BATCH_SIZE);
        batchCount++;
        try {
            const msg = {
                tokens: batch,
                notification: { title: opts.title, body: opts.body },
            };
            if (opts.data)
                msg.data = opts.data;
            const result = await messaging.sendEachForMulticast(msg);
            successCount += result.successCount;
            failureCount += result.failureCount;
            result.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const code = resp.error?.code;
                    if (code === 'messaging/invalid-registration-token' ||
                        code === 'messaging/registration-token-not-registered') {
                        const token = batch[idx];
                        if (token)
                            invalidTokens.push(token);
                    }
                }
            });
        }
        catch (err) {
            log({
                severity: 'ERROR',
                code: 'fcm.mass.batch.failed',
                message: err instanceof Error ? err.message : 'Batch send failed',
            });
            failureCount += batch.length;
        }
    }
    // Remove invalid tokens from their owning responder docs (mirrors fcm-send.ts cleanup).
    if (invalidTokens.length > 0) {
        const ownerToInvalidTokens = new Map();
        for (const token of invalidTokens) {
            for (const ownerId of tokenOwners.get(token) ?? []) {
                const list = ownerToInvalidTokens.get(ownerId) ?? [];
                list.push(token);
                ownerToInvalidTokens.set(ownerId, list);
            }
        }
        const results = await Promise.allSettled([...ownerToInvalidTokens.entries()].map(async ([ownerId, badTokens]) => {
            const ref = db.collection('responders').doc(ownerId);
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists)
                    return;
                const currentTokens = normalizeFcmTokens(snap.data()?.fcmTokens);
                const invalidSet = new Set(badTokens);
                const remainingTokens = currentTokens.filter((t) => !invalidSet.has(t));
                tx.update(ref, {
                    fcmTokens: FieldValue.arrayRemove(...badTokens),
                    hasFcmToken: remainingTokens.length > 0,
                });
            });
        }));
        const failedCount = results.filter((r) => r.status === 'rejected').length;
        const successfulCount = ownerToInvalidTokens.size - failedCount;
        if (failedCount > 0) {
            log({
                severity: 'ERROR',
                code: 'fcm.mass.cleanup.failed',
                message: String(failedCount) + ' cleanup transaction(s) failed',
            });
        }
        log({
            severity: 'WARNING',
            code: 'fcm.mass.invalid_tokens',
            message: `Cleaned up ${String(invalidTokens.length)} invalid token(s) across ${String(ownerToInvalidTokens.size)} responder(s) in ${String(successfulCount)} successful transaction(s)`,
        });
    }
    log({
        severity: 'INFO',
        code: 'fcm.mass.done',
        message: `Mass FCM sent ${String(successCount)} ok / ${String(failureCount)} failed across ${String(batchCount)} batches`,
    });
    return { successCount, failureCount, batchCount };
}
//# sourceMappingURL=fcm-mass-send.js.map