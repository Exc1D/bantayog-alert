import { type Firestore } from 'firebase-admin/firestore';
import { type Auth } from 'firebase-admin/auth';
export declare function requestDataErasureCore(db: Firestore, auth: Auth, actor: {
    uid: string;
}): Promise<void>;
export declare const requestDataErasure: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
//# sourceMappingURL=request-data-erasure.d.ts.map