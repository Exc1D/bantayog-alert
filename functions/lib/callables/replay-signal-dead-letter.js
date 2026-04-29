import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { replayHazardSignalProjection } from '../services/hazard-signal-projector.js';
import { pagasaSignalPollCore } from '../triggers/pagasa-signal-poll.js';
const replaySignalDeadLetterInputSchema = z
    .object({
    category: z.enum(['pagasa_scraper', 'hazard_signal_projection']),
})
    .strict();
function assertPrivilegedActor(actor) {
    if (actor.role !== 'provincial_superadmin') {
        throw new HttpsError('permission-denied', 'superadmin_required');
    }
}
function extractReplayableHtml(payload) {
    if (typeof payload === 'string')
        return payload;
    if (!payload || typeof payload !== 'object')
        return null;
    const html = payload.html;
    if (typeof html === 'string' && html.length > 0)
        return html;
    return null;
}
/**
 * Replays unresolved dead-letter entries for a given category.
 * For `hazard_signal_projection`, replays the full projection and marks all items resolved.
 * For `pagasa_scraper`, re-processes each dead letter's HTML payload through the
 * PAGASA poll pipeline and marks individual items resolved on success.
 *
 * @param db - Firestore instance
 * @param input - Replay category (`pagasa_scraper` or `hazard_signal_projection`)
 * @param actor - Authenticated user with role claim
 * @returns Number of dead letters successfully replayed
 * @throws HttpsError('permission-denied') if actor is not provincial_superadmin
 * @throws HttpsError('failed-precondition') if a pagasa_scraper dead letter has no replayable HTML
 */
export async function replaySignalDeadLetterCore(db, input, actor) {
    assertPrivilegedActor(actor);
    const snap = await db
        .collection('dead_letters')
        .where('category', '==', input.category)
        .limit(20)
        .get();
    // Filter to unresolved items in memory to avoid composite index requirement
    const unresolved = snap.docs.filter((d) => d.data().resolvedAt === undefined);
    const now = Date.now();
    if (input.category === 'hazard_signal_projection') {
        if (unresolved.length === 0)
            return { replayed: 0 };
        await replayHazardSignalProjection({ db, now });
        await Promise.all(unresolved.map(async (doc) => {
            await doc.ref.update({
                resolvedAt: now,
                resolvedBy: actor.uid,
            });
        }));
        return { replayed: unresolved.length };
    }
    let replayed = 0;
    for (const doc of unresolved) {
        const payload = extractReplayableHtml(doc.data().payload);
        if (payload === null) {
            throw new HttpsError('failed-precondition', 'dead_letter_payload_unreplayable');
        }
        const result = await pagasaSignalPollCore({
            db,
            fetchHtml: () => Promise.resolve(payload),
            now: () => now,
        });
        if (result.status !== 'updated')
            continue;
        await doc.ref.update({
            resolvedAt: now,
            resolvedBy: actor.uid,
        });
        replayed++;
    }
    return { replayed };
}
export const replaySignalDeadLetter = onCall({ region: 'asia-southeast1', enforceAppCheck: true }, async (request) => {
    if (!request.auth)
        throw new HttpsError('unauthenticated', 'sign-in required');
    const role = request.auth.token.role;
    const actor = {
        uid: request.auth.uid,
        role: typeof role === 'string' ? role : '',
    };
    const parsed = replaySignalDeadLetterInputSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new HttpsError('invalid-argument', 'unsupported replay category');
    }
    assertPrivilegedActor(actor);
    return replaySignalDeadLetterCore(getFirestore(), parsed.data, actor);
});
//# sourceMappingURL=replay-signal-dead-letter.js.map