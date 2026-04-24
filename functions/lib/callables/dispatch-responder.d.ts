import { type DispatchResponderCoreDeps } from './dispatch-responder-validation.js';
import type { Database } from 'firebase-admin/database';
export type { DispatchResponderCoreDeps } from './dispatch-responder-validation.js';
export declare function dispatchResponderCore(db: FirebaseFirestore.Firestore, rtdb: Database, deps: DispatchResponderCoreDeps): Promise<{
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