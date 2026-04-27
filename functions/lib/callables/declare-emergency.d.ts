import { type Firestore } from 'firebase-admin/firestore';
export declare function declareEmergencyCore(db: Firestore, input: unknown, actor: {
    uid: string;
}): Promise<{
    alertId: string;
}>;
export declare const declareEmergency: import("firebase-functions/https").CallableFunction<any, Promise<{
    alertId: string;
}>, unknown>;
//# sourceMappingURL=declare-emergency.d.ts.map