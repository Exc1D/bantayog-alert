import { Timestamp } from 'firebase-admin/firestore';
export declare function dispatchTimeoutSweepCore(db: FirebaseFirestore.Firestore, now: Timestamp): Promise<void>;
export declare const dispatchTimeoutSweep: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=dispatch-timeout-sweep.d.ts.map