import { type Firestore } from 'firebase-admin/firestore';
import { type SmsProvider } from '../services/sms-provider.js';
type Status = 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'deferred' | 'abandoned';
export interface DispatchSmsOutboxCoreArgs {
    db: Firestore;
    outboxId: string;
    previousStatus: Status | undefined;
    currentStatus: Status;
    now: () => number;
    resolveProvider: (target: 'semaphore' | 'globelabs') => SmsProvider;
}
export declare function dispatchSmsOutboxCore(args: DispatchSmsOutboxCoreArgs): Promise<void>;
export declare const dispatchSmsOutbox: import("firebase-functions").CloudFunction<import("firebase-functions/firestore").FirestoreEvent<import("firebase-functions/firestore").Change<import("firebase-functions/firestore").DocumentSnapshot> | undefined, {
    outboxId: string;
}>>;
export {};
//# sourceMappingURL=dispatch-sms-outbox.d.ts.map