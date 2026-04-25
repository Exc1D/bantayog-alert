import { Timestamp } from 'firebase-admin/firestore';
export interface ShareReportDeps {
    reportId: string;
    targetMunicipalityId: string;
    reason?: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: Record<string, unknown>;
    };
    now: Timestamp;
}
export declare function shareReportCore(db: FirebaseFirestore.Firestore, deps: ShareReportDeps): Promise<{
    status: 'shared';
}>;
export declare const shareReport: import("firebase-functions/https").CallableFunction<any, Promise<{
    status: "shared";
}>, unknown>;
//# sourceMappingURL=share-report.d.ts.map