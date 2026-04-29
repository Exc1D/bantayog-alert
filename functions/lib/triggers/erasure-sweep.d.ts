import { type Firestore } from 'firebase-admin/firestore';
import { type Auth } from 'firebase-admin/auth';
import { type Storage } from 'firebase-admin/storage';
export interface ErasureSweepInput {
    db: Firestore;
    auth: Auth;
    storage: Storage;
    now?: () => number;
}
export interface ErasureSweepResult {
    processed: number;
    skippedHeld: number;
    deadLettered: number;
}
export declare function erasureSweepCore(input: ErasureSweepInput): Promise<ErasureSweepResult>;
export declare const erasureSweep: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=erasure-sweep.d.ts.map