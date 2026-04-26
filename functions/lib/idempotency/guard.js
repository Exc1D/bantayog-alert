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
export class IdempotencyInProgressError extends Error {
    key;
    constructor(key) {
        super(`IN_PROGRESS: idempotency key "${key}" is currently being processed by a concurrent call`);
        this.key = key;
        this.name = 'IdempotencyInProgressError';
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
                processing: true,
            });
            return null;
        }
        const data = snap.data();
        if (data.payloadHash !== hash) {
            throw new IdempotencyMismatchError(opts.key, data.firstSeenAt);
        }
        if (data.processing && !('resultPayload' in data)) {
            throw new IdempotencyInProgressError(opts.key);
        }
        return (data.resultPayload ?? null);
    });
    if (cached != null) {
        return { result: cached, fromCache: true };
    }
    const result = await op();
    await keyRef.update({ resultPayload: result, processing: false, completedAt: now() });
    return { result, fromCache: false };
}
//# sourceMappingURL=guard.js.map