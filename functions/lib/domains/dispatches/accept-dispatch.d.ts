import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const acceptDispatchRequestSchema: z.ZodObject<{
    dispatchId: z.ZodString;
    idempotencyKey: z.ZodString;
}, z.core.$strict>;
export type AcceptDispatchRequest = z.infer<typeof acceptDispatchRequestSchema>;
export interface AcceptDispatchCoreDeps {
    dispatchId: string;
    idempotencyKey: string;
    actor: {
        uid: string;
    };
    now: Timestamp;
}
export declare function acceptDispatchCore(db: Firestore, deps: AcceptDispatchCoreDeps): Promise<{
    status: 'accepted';
    dispatchId: string;
    fromCache: boolean;
}>;
export declare const acceptDispatch: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "accepted";
    dispatchId: string;
    fromCache: boolean;
}>, unknown>;
//# sourceMappingURL=accept-dispatch.d.ts.map