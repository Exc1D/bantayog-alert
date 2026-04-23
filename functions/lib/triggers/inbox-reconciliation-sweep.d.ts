import { getFirestore } from 'firebase-admin/firestore';
export interface SweepInput {
    db: ReturnType<typeof getFirestore>;
    now?: () => number;
}
export interface SweepResult {
    candidates: number;
    processed: number;
    failed: number;
    oldestAgeMs: number | null;
}
export declare function inboxReconciliationSweepCore(input: SweepInput): Promise<SweepResult>;
export declare const inboxReconciliationSweep: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=inbox-reconciliation-sweep.d.ts.map