import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const reopenReportSchema: z.ZodObject<{
    reportId: z.ZodString;
    reason: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export interface ReopenReportCoreDeps {
    reportId: string;
    reason: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role?: string;
            municipalityId?: string;
            permittedMunicipalityIds?: string[];
        };
    };
    now: Timestamp;
}
export declare function reopenReportCore(db: Firestore, deps: ReopenReportCoreDeps): Promise<{
    reportId: string;
    status: 'reopened';
}>;
export declare const reopenReport: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    reportId: string;
    status: "reopened";
}>, unknown>;
//# sourceMappingURL=reopen-report.d.ts.map