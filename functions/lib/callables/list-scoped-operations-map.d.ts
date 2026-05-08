import { type ScopedOperationsMapIncidentPayload } from '@bantayog/shared-types';
export interface ListScopedOperationsMapResult {
    incidents: ScopedOperationsMapIncidentPayload[];
}
export declare function listScopedOperationsMapCore(db: FirebaseFirestore.Firestore, actor: {
    uid: string;
    claims: Record<string, unknown>;
}): Promise<ListScopedOperationsMapResult>;
export declare const listScopedOperationsMap: import("firebase-functions/https").CallableFunction<unknown, Promise<ListScopedOperationsMapResult>, unknown>;
//# sourceMappingURL=list-scoped-operations-map.d.ts.map