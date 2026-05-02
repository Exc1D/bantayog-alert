import { type Firestore, Timestamp } from 'firebase-admin/firestore';
export interface SubscribeToAlertsCoreDeps {
    token: string;
    actor: {
        uid: string;
    };
    now: Timestamp;
}
export declare function subscribeToAlertsCore(db: Firestore, deps: SubscribeToAlertsCoreDeps): Promise<{
    success: true;
}>;
export declare const subscribeToAlerts: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    success: true;
}>, unknown>;
//# sourceMappingURL=subscribe-to-alerts.d.ts.map