import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
export async function checkRateLimit(db, { key, limit, windowSeconds, now, updatedAt }) {
    const ref = db.collection('rate_limits').doc(key);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const windowStartMs = now.toMillis() - windowSeconds * 1000;
        const bucket = snap.exists ? snap.data() : undefined;
        const existingTimes = Array.isArray(bucket?.timestamps) ? bucket.timestamps : [];
        const fresh = existingTimes.filter((ms) => ms >= windowStartMs);
        if (fresh.length >= limit) {
            const earliest = Math.min(...fresh);
            const retryAfterSeconds = Math.ceil((earliest + windowSeconds * 1000 - now.toMillis()) / 1000);
            return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
        }
        fresh.push(now.toMillis());
        const pruned = fresh.slice(-limit);
        tx.set(ref, { timestamps: pruned, updatedAt: updatedAt ?? AdminTimestamp.now() }, { merge: true });
        return { allowed: true, remaining: limit - pruned.length, retryAfterSeconds: 0 };
    });
}
//# sourceMappingURL=rate-limit.js.map