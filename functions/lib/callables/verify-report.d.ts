import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { type ReportStatus } from '@bantayog/shared-validators';
export interface VerifyReportInput {
    reportId: string;
    scrubbedDescription?: string;
    idempotencyKey: string;
}
export interface VerifyReportResult {
    status: ReportStatus;
    reportId: string;
}
export interface VerifyReportActor {
    uid: string;
    claims: {
        role?: string;
        municipalityId?: string;
        active?: boolean;
    };
}
export interface VerifyReportCoreDeps {
    reportId: string;
    scrubbedDescription?: string;
    idempotencyKey: string;
    actor: VerifyReportActor;
    now: Timestamp;
}
export declare function verifyReportCore(db: Firestore, deps: VerifyReportCoreDeps): Promise<VerifyReportResult>;
export declare const verifyReport: import("firebase-functions/https").CallableFunction<unknown, Promise<VerifyReportResult>, unknown>;
//# sourceMappingURL=verify-report.d.ts.map