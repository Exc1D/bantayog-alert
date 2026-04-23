import { type Firestore } from 'firebase-admin/firestore';
export interface ReconcileArgs {
    db: Firestore;
    now: () => number;
}
export declare function reconcileSmsDeliveryStatusCore({ db, now }: ReconcileArgs): Promise<void>;
export declare const reconcileSmsDeliveryStatus: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=reconcile-sms-delivery-status.d.ts.map