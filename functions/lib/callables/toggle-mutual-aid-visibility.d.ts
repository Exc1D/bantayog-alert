import { type Firestore } from 'firebase-admin/firestore';
export declare function toggleMutualAidVisibilityCore(db: Firestore, input: unknown, actor: {
    uid: string;
}): Promise<void>;
export declare const toggleMutualAidVisibility: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
//# sourceMappingURL=toggle-mutual-aid-visibility.d.ts.map