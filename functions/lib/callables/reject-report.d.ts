import { Firestore, Timestamp } from 'firebase-admin/firestore';
declare const REJECT_REASONS: readonly ["obviously_false", "duplicate", "test_submission", "insufficient_detail"];
type RejectReason = (typeof REJECT_REASONS)[number];
export interface RejectReportCoreDeps {
    reportId: string;
    reason: RejectReason;
    notes?: string | undefined;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role?: string;
            municipalityId?: string;
        };
    };
    now: Timestamp;
}
export declare function rejectReportCore(db: Firestore, deps: RejectReportCoreDeps): Promise<{
    status: "cancelled_false_report";
    reportId: string;
}>;
export declare const rejectReport: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "cancelled_false_report";
    reportId: string;
}>, unknown>;
export {};
//# sourceMappingURL=reject-report.d.ts.map