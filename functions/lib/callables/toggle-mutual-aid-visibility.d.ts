import { type Firestore } from 'firebase-admin/firestore';
export declare function toggleMutualAidVisibilityCore(db: Firestore, input: {
    agencyId: string;
    visible: boolean;
}, actor: {
    uid: string;
}): Promise<void>;
export declare const toggleMutualAidVisibility: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
//# sourceMappingURL=toggle-mutual-aid-visibility.d.ts.map