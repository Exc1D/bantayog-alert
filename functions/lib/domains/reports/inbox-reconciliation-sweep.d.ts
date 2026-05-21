import { getFirestore } from 'firebase-admin/firestore';
import { type ProcessInboxItemCoreInput, type ProcessInboxItemCoreResult } from './process-inbox-item.js';
export interface SweepInput {
    db: ReturnType<typeof getFirestore>;
    now?: () => number;
    processInboxItem?: (input: ProcessInboxItemCoreInput) => Promise<ProcessInboxItemCoreResult>;
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