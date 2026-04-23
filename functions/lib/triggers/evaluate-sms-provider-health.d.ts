import { type Firestore } from 'firebase-admin/firestore';
export interface EvalArgs {
    db: Firestore;
    now: () => number;
}
export declare function evaluateSmsProviderHealthCore({ db, now }: EvalArgs): Promise<void>;
export declare const evaluateSmsProviderHealth: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=evaluate-sms-provider-health.d.ts.map