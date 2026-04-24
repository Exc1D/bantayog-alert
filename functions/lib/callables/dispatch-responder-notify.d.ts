import type { Firestore, Transaction } from 'firebase-admin/firestore';
interface EnqueueDispatchSmsArgs {
    db: Firestore;
    tx: Transaction;
    reportId: string;
    dispatchId: string;
    recipientMsisdn: string;
    locale: 'tl' | 'en';
    publicRef: string;
    salt: string;
    nowMs: number;
}
export declare function enqueueDispatchSms(args: EnqueueDispatchSmsArgs): void;
export {};
//# sourceMappingURL=dispatch-responder-notify.d.ts.map