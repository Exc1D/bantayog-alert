import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { type ReportStatus } from '@bantayog/shared-validators';
export declare const closeReportRequestSchema: z.ZodObject<{
    reportId: z.ZodString;
    idempotencyKey: z.ZodString;
    closureSummary: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CloseReportRequest = z.infer<typeof closeReportRequestSchema>;
export interface CloseReportResult {
    status: ReportStatus;
    reportId: string;
}
export interface CloseReportActor {
    uid: string;
    claims: {
        role?: string;
        municipalityId?: string;
        active?: boolean;
    };
}
export interface CloseReportCoreDeps {
    reportId: string;
    idempotencyKey: string;
    closureSummary?: string | undefined;
    actor: CloseReportActor;
    now: Timestamp;
}
export declare function closeReportCore(db: Firestore, deps: CloseReportCoreDeps): Promise<CloseReportResult>;
export declare const closeReport: import("firebase-functions/https").CallableFunction<unknown, Promise<CloseReportResult>, unknown>;
//# sourceMappingURL=close-report.d.ts.map