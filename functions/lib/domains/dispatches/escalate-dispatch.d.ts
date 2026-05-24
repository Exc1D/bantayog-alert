import { Firestore, Timestamp } from 'firebase-admin/firestore';
type FcmResult = 'sent' | 'no_token' | 'network_error' | 'sent_with_invalid_tokens';
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
    fcmResult: FcmResult;
    fcmWarnings: string[];
    dispatchId: string;
    status: "pending";
    reportId: string;
    responder: {
        agencyId: string | undefined;
        municipalityId: string | undefined;
    };
    correlationId: `${string}-${string}-${string}-${string}-${string}`;
}>;
export declare const escalateDispatch: import("firebase-functions/https").CallableFunction<any, Promise<{
    fcmResult: FcmResult;
    fcmWarnings: string[];
    dispatchId: string;
    status: "pending";
    reportId: string;
    responder: {
        agencyId: string | undefined;
        municipalityId: string | undefined;
    };
    correlationId: `${string}-${string}-${string}-${string}-${string}`;
}>, unknown>;
export {};
//# sourceMappingURL=escalate-dispatch.d.ts.map