import { Timestamp } from 'firebase-admin/firestore';
export interface AnalyticsSnapshotDeps {
    date: string;
    now: number | Timestamp;
}
export declare function analyticsSnapshotWriterCore(db: FirebaseFirestore.Firestore, deps: AnalyticsSnapshotDeps): Promise<void>;
export declare const analyticsSnapshotWriter: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=analytics-snapshot-writer.d.ts.map