import { type CallableRequest } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
export interface RequestAgencyAssistanceCoreDeps {
    reportId: string;
    agencyId: string;
    message?: string;
    priority?: 'urgent' | 'normal';
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
export declare function requestAgencyAssistanceCore(db: FirebaseFirestore.Firestore, deps: RequestAgencyAssistanceCoreDeps): Promise<{
    status: 'created';
    requestId: string;
}>;
export declare function requestAgencyAssistanceHandler(request: CallableRequest<unknown>): Promise<{
    status: 'created';
    requestId: string;
}>;
export declare const requestAgencyAssistance: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "created";
    requestId: string;
}>, unknown>;
export interface AcceptAgencyAssistanceCoreDeps {
    requestId: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role: string;
            agencyId?: string;
            accountStatus?: string;
        };
    };
    now: Timestamp;
}
export declare function acceptAgencyAssistanceCore(db: FirebaseFirestore.Firestore, deps: AcceptAgencyAssistanceCoreDeps): Promise<{
    status: 'accepted';
}>;
export interface DeclineAgencyAssistanceCoreDeps {
    requestId: string;
    reason: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role: string;
            agencyId?: string;
            accountStatus?: string;
        };
    };
    now: Timestamp;
}
export declare function declineAgencyAssistanceCore(db: FirebaseFirestore.Firestore, deps: DeclineAgencyAssistanceCoreDeps): Promise<{
    status: 'declined';
}>;
export declare function declineAgencyAssistanceHandler(request: CallableRequest<unknown>): Promise<{
    status: 'declined';
}>;
export declare const declineAgencyAssistance: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "declined";
}>, unknown>;
//# sourceMappingURL=request-agency-assistance.d.ts.map