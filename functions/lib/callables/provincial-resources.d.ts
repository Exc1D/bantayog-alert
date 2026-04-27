import { type Firestore } from 'firebase-admin/firestore';
export declare function upsertProvincialResourceCore(db: Firestore, input: unknown, actor: {
    uid: string;
}): Promise<{
    id: string;
}>;
export declare const upsertProvincialResource: import("firebase-functions/https").CallableFunction<any, Promise<{
    id: string;
}>, unknown>;
export declare function archiveProvincialResourceCore(db: Firestore, input: {
    id: string;
}, actor: {
    uid: string;
}): Promise<void>;
export declare const archiveProvincialResource: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
//# sourceMappingURL=provincial-resources.d.ts.map