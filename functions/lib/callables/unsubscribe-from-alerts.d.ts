export interface UnsubscribeFromAlertsDeps {
    token: string;
    actor: {
        uid: string;
    };
}
export declare function unsubscribeFromAlertsCore(deps: UnsubscribeFromAlertsDeps): Promise<{
    success: true;
}>;
export declare const unsubscribeFromAlerts: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    success: true;
}>, unknown>;
//# sourceMappingURL=unsubscribe-from-alerts.d.ts.map