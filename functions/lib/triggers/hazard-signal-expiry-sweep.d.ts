import { type Firestore } from 'firebase-admin/firestore';
/**
 * Sweeps expired hazard signals and marks them as expired.
 * Queries all active signals whose validUntil has passed, marks each as expired
 * (with error handling per-signal), and replays the projection if any signals were expired.
 *
 * @param input - Firestore instance and optional now() override
 * @returns Count of signals successfully expired
 */
export declare function hazardSignalExpirySweepCore(input: {
    db: Firestore;
    now?: () => number;
}): Promise<{
    expired: number;
}>;
export declare const hazardSignalExpirySweep: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=hazard-signal-expiry-sweep.d.ts.map