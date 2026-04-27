import { type Firestore } from 'firebase-admin/firestore';
export declare function recordIncidentResponseEventCore(db: Firestore, input: unknown, actor: {
    uid: string;
}): Promise<{
    eventId: string;
}>;
export declare const recordIncidentResponseEvent: import("firebase-functions/https").CallableFunction<any, Promise<{
    eventId: string;
}>, unknown>;
//# sourceMappingURL=record-incident-response-event.d.ts.map