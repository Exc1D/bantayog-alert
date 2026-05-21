import { type DispatchResponderCoreDeps } from './dispatch-responder-validation.js';
import type { Database } from 'firebase-admin/database';
export type { DispatchResponderCoreDeps } from './dispatch-responder-validation.js';
type FcmResult = 'sent' | 'no_token' | 'network_error' | 'sent_with_invalid_tokens';
export declare function dispatchResponderCore(db: FirebaseFirestore.Firestore, rtdb: Database, deps: DispatchResponderCoreDeps): Promise<{
    dispatchId: string;
    status: "pending";
    reportId: string;
    correlationId: `${string}-${string}-${string}-${string}-${string}`;
    fcmResult: FcmResult;
    fcmWarnings: string[];
}>;
export declare const dispatchResponder: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    dispatchId: string;
    status: "pending";
    reportId: string;
    correlationId: `${string}-${string}-${string}-${string}-${string}`;
    fcmResult: FcmResult;
    fcmWarnings: string[];
}>, unknown>;
//# sourceMappingURL=dispatch-responder.d.ts.map