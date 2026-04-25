import { onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
import { adminDb } from '../admin-init.js';
import { withIdempotency } from '../idempotency/guard.js';
import { bantayogErrorToHttps, requireAuth } from './https-error.js';
const requestSchema = z
    .object({
    threadId: z.string().min(1).max(128),
    body: z.string().min(1).max(2000),
    idempotencyKey: z.uuid(),
})
    .strict();
export async function addCommandChannelMessageCore(db, deps) {
    const { threadId, body, idempotencyKey, actor, now } = deps;
    const nowMs = now.toMillis();
    const trimmedBody = body.trim();
    if (!trimmedBody)
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'body cannot be empty');
    if (trimmedBody.length > 2000)
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'body exceeds 2000 chars');
    if (actor.claims.accountStatus !== 'active') {
        throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'account is not active');
    }
    await withIdempotency(db, {
        key: `addChannelMessage:${actor.uid}:${idempotencyKey}`,
        payload: { threadId, body: trimmedBody },
        now: () => nowMs,
    }, async () => {
        const threadRef = db.collection('command_channel_threads').doc(threadId);
        const msgRef = db.collection('command_channel_messages').doc();
        await db.runTransaction(async (tx) => {
            const threadSnap = await tx.get(threadRef);
            if (!threadSnap.exists) {
                throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'thread not found');
            }
            const thread = threadSnap.data();
            const participantUids = thread.participantUids;
            if (!participantUids || typeof participantUids !== 'object') {
                throw new BantayogError(BantayogErrorCode.INTERNAL_ERROR, 'invalid thread data');
            }
            if (!participantUids[actor.uid]) {
                throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'caller is not a thread participant');
            }
            tx.set(msgRef, {
                threadId,
                authorUid: actor.uid,
                authorRole: actor.claims.role,
                body: trimmedBody,
                createdAt: nowMs,
                schemaVersion: 1,
            });
            tx.update(threadRef, {
                lastMessageAt: nowMs,
                updatedAt: nowMs,
            });
        });
        return { status: 'sent' };
    });
    return { status: 'sent' };
}
export const addCommandChannelMessage = onCall({ region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' }, async (req) => {
    const actor = requireAuth(req, ['municipal_admin', 'agency_admin', 'provincial_superadmin']);
    try {
        const input = requestSchema.parse(req.data);
        return await addCommandChannelMessageCore(adminDb, {
            ...input,
            actor: {
                uid: actor.uid,
                claims: actor.claims,
            },
            now: Timestamp.now(),
        });
    }
    catch (err) {
        if (err instanceof BantayogError)
            throw bantayogErrorToHttps(err);
        throw err;
    }
});
//# sourceMappingURL=add-command-channel-message.js.map