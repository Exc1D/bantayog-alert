import { type Firestore } from 'firebase-admin/firestore';
import { type Storage } from 'firebase-admin/storage';
export interface RetentionSweepInput {
    db: Firestore;
    storage: Storage;
    now?: () => number;
}
export interface RetentionSweepResult {
    anonymized: number;
    hardDeleted: number;
}
export declare function retentionSweepCore(input: RetentionSweepInput): Promise<RetentionSweepResult>;
export declare const retentionSweep: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=retention-sweep.d.ts.map