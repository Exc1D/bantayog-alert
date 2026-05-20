import { getMonitorConfig } from '../services/monitor-config.js';
export interface MonitorDispatchDeadlinesDeps {
    now: number;
    config: Awaited<ReturnType<typeof getMonitorConfig>>;
}
export declare function monitorDispatchDeadlinesCore(db: FirebaseFirestore.Firestore, deps: MonitorDispatchDeadlinesDeps): Promise<void>;
export declare const monitorDispatchDeadlines: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=monitor-dispatch-deadlines.d.ts.map