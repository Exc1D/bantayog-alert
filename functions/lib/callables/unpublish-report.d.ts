import { Firestore, Timestamp } from 'firebase-admin/firestore';
declare const UNPUBLISH_REASONS: readonly ["sensitive_content", "privacy_request", "false_or_misleading", "legal_request", "other"];
type UnpublishReason = (typeof UNPUBLISH_REASONS)[number];
export interface UnpublishReportResult {
    reportId: string;
    visibilityClass: 'internal';
    updatedAt: number;
}
export interface UnpublishReportCoreDeps {
    reportId: string;
    reason: UnpublishReason;
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
export declare function unpublishReportCore(db: Firestore, deps: UnpublishReportCoreDeps): Promise<UnpublishReportResult>;
export declare const unpublishReport: import("firebase-functions/https").CallableFunction<unknown, Promise<UnpublishReportResult>, unknown>;
export {};
//# sourceMappingURL=unpublish-report.d.ts.map