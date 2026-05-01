import { type Firestore } from 'firebase-admin/firestore';
export declare function setRetentionExemptCore(db: Firestore, input: unknown, actor: {
    uid: string;
    permittedMunicipalityIds: string[];
}): Promise<void>;
export declare const setRetentionExempt: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
//# sourceMappingURL=set-retention-exempt.d.ts.map