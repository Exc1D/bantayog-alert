import { type Firestore } from 'firebase-admin/firestore';
export declare function declareDataIncidentCore(db: Firestore, input: unknown, actor: {
    uid: string;
}): Promise<{
    incidentId: string;
}>;
export declare const declareDataIncident: import("firebase-functions/https").CallableFunction<any, Promise<{
    incidentId: string;
}>, unknown>;
//# sourceMappingURL=declare-data-incident.d.ts.map