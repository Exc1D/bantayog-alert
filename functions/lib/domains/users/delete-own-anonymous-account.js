import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { logDimension } from '@bantayog/shared-validators';
import { shouldEnforceAppCheck } from '../shared/app-check-config.js';
import { getCitizenCallableCorsOrigins } from '../shared/callable-config.js';
import { streamAuditEvent } from '../ops/audit-stream.js';
const log = logDimension('deleteOwnAnonymousAccount');
export const deleteOwnAnonymousAccount = onCall({
    cors: getCitizenCallableCorsOrigins(),
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
}, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError('unauthenticated', 'Authentication required.');
    }
    const auth = getAuth();
    let userRecord;
    try {
        userRecord = await auth.getUser(uid);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log({
            severity: 'WARNING',
            code: 'ANONYMOUS_DELETE_USER_NOT_FOUND',
            message: `uid ${uid} not found in Auth: ${msg}`,
        });
        throw new HttpsError('not-found', 'User not found.');
    }
    if (userRecord.providerData.length > 0 || userRecord.email || userRecord.phoneNumber) {
        throw new HttpsError('permission-denied', 'Only anonymous accounts can be deleted this way.');
    }
    await auth.deleteUser(uid);
    void streamAuditEvent({
        eventType: 'account_deleted',
        actorUid: uid,
        metadata: { reason: 'anonymous_self_delete' },
        occurredAt: Date.now(),
    });
    return { deleted: true };
});
//# sourceMappingURL=delete-own-anonymous-account.js.map