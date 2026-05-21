import { Firestore, Timestamp } from 'firebase-admin/firestore';
declare const CANCEL_REASONS: readonly ["responder_unavailable", "duplicate_report", "admin_error", "citizen_withdrew"];
export type CancelReason = (typeof CANCEL_REASONS)[number];
export interface CancelDispatchCoreDeps {
    dispatchId: string;
    reason: CancelReason;
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
export declare function cancelDispatchCore(db: Firestore, deps: CancelDispatchCoreDeps): Promise<{
    status: "cancelled";
    dispatchId: string;
}>;
export declare const cancelDispatch: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "cancelled";
    dispatchId: string;
}>, unknown>;
export {};
//# sourceMappingURL=cancel-dispatch.d.ts.map