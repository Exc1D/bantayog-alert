import { Firestore } from 'firebase-admin/firestore';
export interface GetOpsMetricsCoreDeps {
    timeRange: '1h' | '24h' | '7d';
    actor: {
        claims: {
            role?: string;
            municipalityId?: string;
            agencyId?: string;
        };
    };
}
interface Scope {
    type: 'municipality' | 'agency' | 'province';
    id: string;
}
export declare function getOpsMetricsCore(db: Firestore, deps: GetOpsMetricsCoreDeps): Promise<{
    timeRange: "1h" | "24h" | "7d";
    scope: Scope;
    metrics: {
        avgAcceptSeconds: number | null;
        fcmSuccessRate: number;
        totalDispatches: number;
        acceptedCount: number;
        declinedCount: number;
        escalatedCount: number;
        needsAdminCount: number;
        fcmSuccessCount: number;
        fcmFailureCount: number;
        totalAcceptSeconds: number;
        acceptCountWithTimestamps: number;
    };
}>;
export declare const getOpsMetrics: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    timeRange: "1h" | "24h" | "7d";
    scope: Scope;
    metrics: {
        avgAcceptSeconds: number | null;
        fcmSuccessRate: number;
        totalDispatches: number;
        acceptedCount: number;
        declinedCount: number;
        escalatedCount: number;
        needsAdminCount: number;
        fcmSuccessCount: number;
        fcmFailureCount: number;
        totalAcceptSeconds: number;
        acceptCountWithTimestamps: number;
    };
}>, unknown>;
export {};
//# sourceMappingURL=callables.d.ts.map