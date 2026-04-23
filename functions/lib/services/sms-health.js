import { FieldValue } from 'firebase-admin/firestore';
export class NoProviderAvailableError extends Error {
    constructor() {
        super('No SMS provider available (both circuits open)');
        this.name = 'NoProviderAvailableError';
    }
}
export async function readCircuitState(db, providerId) {
    const snap = await db.collection('sms_provider_health').doc(providerId).get();
    if (!snap.exists)
        return 'closed';
    const data = snap.data();
    return data?.circuitState ?? 'closed';
}
export async function pickProvider(db) {
    const [semaphore, globelabs] = await Promise.all([
        readCircuitState(db, 'semaphore'),
        readCircuitState(db, 'globelabs'),
    ]);
    const usable = (s) => s === 'closed' || s === 'half_open';
    if (usable(semaphore))
        return 'semaphore';
    if (usable(globelabs))
        return 'globelabs';
    throw new NoProviderAvailableError();
}
function minuteWindowId(tsMs) {
    const d = new Date(tsMs);
    const y = d.getUTCFullYear().toString();
    const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const da = d.getUTCDate().toString().padStart(2, '0');
    const h = d.getUTCHours().toString().padStart(2, '0');
    const mi = d.getUTCMinutes().toString().padStart(2, '0');
    return `${y}${mo}${da}${h}${mi}`;
}
export async function incrementMinuteWindow(db, providerId, outcome, nowMs) {
    const windowId = minuteWindowId(nowMs);
    const windowStartMs = nowMs - (nowMs % 60_000);
    const ref = db
        .collection('sms_provider_health')
        .doc(providerId)
        .collection('minute_windows')
        .doc(windowId);
    const maxLatency = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const existing = snap.data();
        const currentMax = existing?.maxLatencyMs ?? 0;
        return Math.max(currentMax, outcome.latencyMs);
    });
    await ref.set({
        providerId,
        windowStartMs,
        attempts: FieldValue.increment(1),
        failures: FieldValue.increment(outcome.success ? 0 : 1),
        rateLimitedCount: FieldValue.increment(outcome.rateLimited ? 1 : 0),
        latencySumMs: FieldValue.increment(outcome.latencyMs),
        maxLatencyMs: maxLatency,
        updatedAt: nowMs,
        schemaVersion: 1,
    }, { merge: true });
}
//# sourceMappingURL=sms-health.js.map