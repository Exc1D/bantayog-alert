import { Firestore, Timestamp } from 'firebase-admin/firestore';
export interface CancelReportByCitizenCoreDeps {
    reportId: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role?: string;
        };
    };
    now: Timestamp;
}
export interface CancelReportByCitizenResult {
    reportId: string;
}
export declare function cancelReportByCitizenCore(db: Firestore, deps: CancelReportByCitizenCoreDeps): Promise<CancelReportByCitizenResult>;
export declare const cancelReportByCitizen: import("firebase-functions/https").CallableFunction<unknown, Promise<CancelReportByCitizenResult>, unknown>;
//# sourceMappingURL=cancel-report-by-citizen.d.ts.map