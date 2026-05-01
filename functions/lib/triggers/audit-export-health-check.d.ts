import { type Firestore } from 'firebase-admin/firestore';
import { type Messaging } from 'firebase-admin/messaging';
export interface AuditExportHealthCheckResult {
    streamingGapSeconds: number;
    batchGapSeconds: number;
    healthy: boolean;
}
export declare function auditExportHealthCheckCore(db: Firestore, messaging: Messaging, opts: {
    query: (sql: string, options: {
        timeoutMs: number;
    }) => Promise<[unknown[], ...unknown[]]>;
    now: () => number;
}): Promise<AuditExportHealthCheckResult>;
export declare const auditExportHealthCheck: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=audit-export-health-check.d.ts.map