import { Timestamp, type Firestore } from 'firebase-admin/firestore';
export interface SubmitReportFeedbackCoreDeps {
    reportId: string;
    addressed: boolean;
    comment?: string | undefined;
    actor: {
        uid: string;
        claims: {
            role?: string;
        };
    };
    now: Timestamp;
}
export interface SubmitReportFeedbackResult {
    reportId: string;
    addressed: boolean;
    submittedAt: number;
    updatedAt: number;
}
export declare function submitReportFeedbackCore(db: Firestore, deps: SubmitReportFeedbackCoreDeps): Promise<SubmitReportFeedbackResult>;
export declare const submitReportFeedback: import("firebase-functions/https").CallableFunction<unknown, Promise<SubmitReportFeedbackResult>, unknown>;
//# sourceMappingURL=submit-report-feedback.d.ts.map