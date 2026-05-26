import { type Firestore, Timestamp } from 'firebase-admin/firestore';
export interface UnsubscribeFromAlertsDeps {
    token: string;
    actor: {
        uid: string;
    };
    now: Timestamp;
}
export declare function unsubscribeFromAlertsCore(db: Firestore, deps: UnsubscribeFromAlertsDeps): Promise<{
    success: true;
}>;
export declare const unsubscribeFromAlerts: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    success: true;
}>, unknown>;
//# sourceMappingURL=unsubscribe-to-alerts.d.ts.map