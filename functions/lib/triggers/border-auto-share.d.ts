export interface BorderAutoShareDeps {
    reportId: string;
    opsData: Record<string, unknown>;
    boundaryGeohashSet: ReadonlySet<string>;
}
export declare function borderAutoShareCore(db: FirebaseFirestore.Firestore, deps: BorderAutoShareDeps): Promise<void>;
export declare const borderAutoShareTrigger: import("firebase-functions").CloudFunction<import("firebase-functions/firestore").FirestoreEvent<import("firebase-functions/firestore").QueryDocumentSnapshot | undefined, {
    reportId: string;
}>>;
//# sourceMappingURL=border-auto-share.d.ts.map