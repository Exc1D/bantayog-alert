import { type Firestore } from 'firebase-admin/firestore';
export declare function approveErasureRequestCore(db: Firestore, input: {
    erasureRequestId: string;
    approved: boolean;
    reason?: string;
}, actor: {
    uid: string;
}): Promise<void>;
export declare const approveErasureRequest: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
//# sourceMappingURL=approve-erasure-request.d.ts.map