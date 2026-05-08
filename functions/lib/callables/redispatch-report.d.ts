import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const redispatchReportSchema: z.ZodObject<{
    oldDispatchId: z.ZodString;
    newResponderUid: z.ZodString;
    reason: z.ZodString;
    idempotencyKey: z.ZodString;
}, z.core.$strict>;
export interface RedispatchReportCoreDeps {
    oldDispatchId: string;
    newResponderUid: string;
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
export declare function redispatchReportCore(db: Firestore, deps: RedispatchReportCoreDeps): Promise<{
    newDispatchId: string;
    status: 'pending';
    reportId: string;
}>;
export declare const redispatchReport: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    newDispatchId: string;
    status: "pending";
    reportId: string;
}>, unknown>;
//# sourceMappingURL=redispatch-report.d.ts.map