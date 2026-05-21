import { Timestamp } from 'firebase-admin/firestore';
export interface AdminOperationsSweepDeps {
    now: Timestamp;
}
export declare function adminOperationsSweepCore(db: FirebaseFirestore.Firestore, deps: AdminOperationsSweepDeps): Promise<void>;
export declare const adminOperationsSweep: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=admin-operations-sweep.d.ts.map