import { canonicalPayloadHash } from '@bantayog/shared-validators';
export class IdempotencyMismatchError extends Error {
    key;
    firstSeenAt;
    constructor(key, firstSeenAt) {
        super(`ALREADY_EXISTS_DIFFERENT_PAYLOAD: idempotency key "${key}" was first seen at ${String(firstSeenAt)} with a different payload`);
        this.key = key;
        this.firstSeenAt = firstSeenAt;
        this.name = 'IdempotencyMismatchError';
    }
}
export async function withIdempotency(db, opts, op) {
    const now = opts.now ?? (() => Date.now());
    const hash = await canonicalPayloadHash(opts.payload);
    const keyRef = db.collection('idempotency_keys').doc(opts.key);
    const cached = await db.runTransaction(async (tx) => {
        const snap = await tx.get(keyRef);
        if (!snap.exists) {
            tx.set(keyRef, {
                key: opts.key,
                payloadHash: hash,
                firstSeenAt: now(),
            });
            return null;
        }
        const data = snap.data();
        if (data.payloadHash !== hash) {
            throw new IdempotencyMismatchError(opts.key, data.firstSeenAt);
        }
        return (data.resultPayload ?? null);
    });
    if (cached != null) {
        return { result: cached, fromCache: true };
    }
    const result = await op();
    await keyRef.update({ resultPayload: result, completedAt: now() });
    return { result, fromCache: false };
}
//# sourceMappingURL=guard.js.map