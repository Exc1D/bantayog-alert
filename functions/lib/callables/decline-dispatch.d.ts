import { type CallableRequest } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const declineDispatchRequestSchema: z.ZodObject<{
    dispatchId: z.ZodString;
    declineReason: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export interface DeclineDispatchCoreDeps {
    dispatchId: string;
    declineReason: string;
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
export declare function declineDispatchCore(db: FirebaseFirestore.Firestore, deps: DeclineDispatchCoreDeps): Promise<{
    status: 'declined';
}>;
export declare function declineDispatchHandler(request: CallableRequest<unknown>): Promise<{
    status: "declined";
}>;
export declare const declineDispatch: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "declined";
}>, unknown>;
//# sourceMappingURL=decline-dispatch.d.ts.map