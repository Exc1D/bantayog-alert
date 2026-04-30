import { type Firestore } from 'firebase-admin/firestore';
import { type Auth } from 'firebase-admin/auth';
export declare function approveErasureRequestCore(db: Firestore, auth: Auth, input: unknown, actor: {
    uid: string;
}): Promise<void>;
export declare const approveErasureRequest: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
//# sourceMappingURL=approve-erasure-request.d.ts.map