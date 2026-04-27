import { type Firestore } from 'firebase-admin/firestore';
export declare function setRetentionExemptCore(db: Firestore, input: {
    collection: string;
    documentId: string;
    exempt: boolean;
    reason: string;
}, actor: {
    uid: string;
}): Promise<void>;
export declare const setRetentionExempt: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
//# sourceMappingURL=set-retention-exempt.d.ts.map