import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const markDispatchUnableToCompleteSchema: z.ZodObject<{
    dispatchId: z.ZodString;
    reason: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export interface MarkDispatchUnableToCompleteCoreDeps {
    dispatchId: string;
    reason: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role: string;
            municipalityId?: string;
        };
    };
    now: Timestamp;
}
export declare function markDispatchUnableToCompleteCore(db: Firestore, deps: MarkDispatchUnableToCompleteCoreDeps): Promise<{
    status: 'unable_to_complete';
    dispatchId: string;
}>;
export declare const markDispatchUnableToComplete: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "unable_to_complete";
    dispatchId: string;
}>, unknown>;
//# sourceMappingURL=mark-dispatch-unable-to-complete.d.ts.map