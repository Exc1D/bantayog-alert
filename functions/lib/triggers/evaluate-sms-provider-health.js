import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logDimension } from '@bantayog/shared-validators';
const log = logDimension('evaluateSmsProviderHealth');
const PROVIDERS = ['semaphore', 'globelabs'];
const ERROR_RATE_THRESHOLD = 0.3;
const MIN_ATTEMPTS_FOR_ERROR_TRIP = 10;
const LATENCY_THRESHOLD_MS = 30_000;
const COOLDOWN_MS = 5 * 60 * 1000;
export async function evaluateSmsProviderHealthCore({ db, now }) {
    for (const providerId of PROVIDERS) {
        await evaluateOne(db, providerId, now());
    }
}
async function evaluateOne(db, providerId, nowMs) {
    const healthRef = db.collection('sms_provider_health').doc(providerId);
    const healthSnap = await healthRef.get();
    const current = (healthSnap.data() ?? { circuitState: 'closed' });
    const windowsSnap = await db
        .collection('sms_provider_health')
        .doc(providerId)
        .collection('minute_windows')
        .orderBy('windowStartMs', 'desc')
        .limit(5)
        .get();
    const windows = windowsSnap.docs.map((d) => d.data());
    const attempts = windows.reduce((s, w) => s + w.attempts, 0);
    const failures = windows.reduce((s, w) => s + w.failures, 0);
    const rateLimited = windows.reduce((s, w) => s + w.rateLimitedCount, 0);
    const errorRate = attempts > 0 ? failures / attempts : 0;
    const maxLatency = windows.reduce((m, w) => Math.max(m, w.maxLatencyMs), 0);
    let nextState = current.circuitState;
    let reason;
    if (current.circuitState === 'closed') {
        if (attempts >= MIN_ATTEMPTS_FOR_ERROR_TRIP && errorRate > ERROR_RATE_THRESHOLD) {
            nextState = 'open';
            reason = `error rate ${String(Math.round(errorRate * 100))}% over ${String(attempts)} attempts`;
        }
        else if (maxLatency > LATENCY_THRESHOLD_MS) {
            nextState = 'open';
            reason = `latency ${String(maxLatency)}ms exceeded ${LATENCY_THRESHOLD_MS.toString()}ms`;
        }
        else if (rateLimited >= 3 && rateLimited === attempts) {
            nextState = 'open';
            reason = `sustained rate-limiting: ${String(rateLimited)}/${String(attempts)}`;
        }
    }
    else if (current.circuitState === 'open') {
        const openedAt = current.openedAt ?? nowMs;
        if (nowMs - openedAt >= COOLDOWN_MS) {
            nextState = 'half_open';
            reason = 'cooldown elapsed';
        }
    }
    else {
        // current.circuitState === 'half_open'
        const latest = windows[0];
        if (latest && latest.attempts > 0) {
            if (latest.failures === 0) {
                nextState = 'closed';
                reason = 'probe success';
            }
            else {
                nextState = 'open';
                reason = 'probe failure';
            }
        }
    }
    if (nextState !== current.circuitState) {
        await healthRef.set({
            providerId,
            circuitState: nextState,
            errorRatePct: Math.round(errorRate * 100),
            openedAt: nextState === 'open' ? nowMs : FieldValue.delete(),
            lastTransitionReason: reason ?? 'state change',
            updatedAt: nowMs,
        }, { merge: true });
        log({
            severity: 'INFO',
            code: 'sms.circuit.transitioned',
            message: `${providerId}: ${current.circuitState} → ${nextState}`,
            data: { reason },
        });
    }
    else {
        await healthRef.set({
            providerId,
            circuitState: nextState,
            errorRatePct: Math.round(errorRate * 100),
            updatedAt: nowMs,
        }, { merge: true });
    }
}
export const evaluateSmsProviderHealth = onSchedule({ schedule: 'every 1 minutes', region: 'asia-southeast1', timeoutSeconds: 60 }, async () => {
    await evaluateSmsProviderHealthCore({ db: getFirestore(), now: () => Date.now() });
});
//# sourceMappingURL=evaluate-sms-provider-health.js.map