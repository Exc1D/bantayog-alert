import { type Firestore } from 'firebase-admin/firestore';
export declare function declareAlertCore(db: Firestore, input: unknown, actor: {
    uid: string;
    claims?: Record<string, unknown>;
}): Promise<{
    alertId: string;
}>;
export declare const declareAlert: import("firebase-functions/https").CallableFunction<any, Promise<{
    alertId: string;
}>, unknown>;
//# sourceMappingURL=declare-alert.d.ts.map