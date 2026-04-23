import { Firestore, Timestamp } from 'firebase-admin/firestore';
import type { Database } from 'firebase-admin/database';
export interface DispatchResponderCoreDeps {
    reportId: string;
    responderUid: string;
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
export declare function dispatchResponderCore(db: Firestore, rtdb: Database, deps: DispatchResponderCoreDeps): Promise<{
    dispatchId: string;
    status: "pending";
    reportId: string;
    correlationId: `${string}-${string}-${string}-${string}-${string}`;
}>;
export declare const dispatchResponder: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    warnings: string[];
    dispatchId: string;
    status: "pending";
    reportId: string;
    correlationId: `${string}-${string}-${string}-${string}-${string}`;
}>, unknown>;
//# sourceMappingURL=dispatch-responder.d.ts.map