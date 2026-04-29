import { type Firestore } from 'firebase-admin/firestore';
import { BigQuery } from '@google-cloud/bigquery';
export interface CostSnapshotWriterDeps {
    now?: () => number;
}
/**
 * Writes a daily cost snapshot to `system_health/latest` in Firestore.
 * Queries BigQuery for today's spend and a 7-day baseline average (including zero-cost days),
 * then flags anomalies where today's cost exceeds 1.5x the baseline.
 *
 * @param db - Firestore instance
 * @param bigQuery - BigQuery client (injectable for testing)
 * @param deps - Optional dependencies (now override)
 * @returns Object with anomaly flag, today's cost, and baseline cost
 */
export declare function costSnapshotWriterCore(db: Firestore, bigQuery: Pick<BigQuery, 'query'>, deps?: CostSnapshotWriterDeps): Promise<{
    anomaly: boolean;
    todayCost: number;
    baselineCost: number;
}>;
export declare const costSnapshotWriter: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=cost-snapshot-writer.d.ts.map