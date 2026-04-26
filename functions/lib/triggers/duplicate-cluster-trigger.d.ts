import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
export declare function duplicateClusterTriggerCore(db: FirebaseFirestore.Firestore, snap: QueryDocumentSnapshot): Promise<void>;
export declare const duplicateClusterTrigger: import("firebase-functions").CloudFunction<import("firebase-functions/firestore").FirestoreEvent<import("firebase-functions/firestore").QueryDocumentSnapshot | undefined, {
    reportId: string;
}>>;
//# sourceMappingURL=duplicate-cluster-trigger.d.ts.map