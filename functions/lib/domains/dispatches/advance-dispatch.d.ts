import { Timestamp } from 'firebase-admin/firestore';
import { type AdvanceDispatchRequest } from '@bantayog/shared-validators';
export declare const advanceDispatchCore: (db: FirebaseFirestore.Firestore, req: AdvanceDispatchRequest & {
    actor: {
        uid: string;
        claims: {
            role: string;
            municipalityId?: string;
        };
    };
    now: Timestamp;
}) => Promise<{
    status: "acknowledged" | "en_route" | "on_scene" | "resolved";
}>;
export declare const advanceDispatch: import("firebase-functions/https").CallableFunction<any, Promise<{
    status: "acknowledged" | "en_route" | "on_scene" | "resolved";
}>, unknown>;
//# sourceMappingURL=advance-dispatch.d.ts.map