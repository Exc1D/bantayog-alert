import { Firestore, Timestamp } from 'firebase-admin/firestore';
export interface EscalateDispatchCoreDeps {
    dispatchId: string;
    newResponderUid: string;
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
export declare function escalateDispatchCore(db: Firestore, deps: EscalateDispatchCoreDeps): Promise<{
    dispatchId: string;
    status: "pending";
    reportId: string;
}>;
export declare const escalateDispatch: import("firebase-functions/https").CallableFunction<any, Promise<{
    dispatchId: string;
    status: "pending";
    reportId: string;
}>, unknown>;
//# sourceMappingURL=escalate-dispatch.d.ts.map