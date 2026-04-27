import { Firestore, Timestamp } from 'firebase-admin/firestore';
export declare const suspendResponder: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    uid: string;
    status: "suspended" | "revoked";
}>, unknown>;
export declare const revokeResponder: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    uid: string;
    status: "suspended" | "revoked";
}>, unknown>;
interface BulkAvailabilityOverrideDeps {
    uids: string[];
    status: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role: string;
            agencyId?: string;
            accountStatus?: string;
        };
    };
    now: Timestamp;
}
export declare function bulkAvailabilityOverrideCore(db: Firestore, deps: BulkAvailabilityOverrideDeps): Promise<{
    updated: number;
}>;
export declare const bulkAvailabilityOverride: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    updated: number;
}>, unknown>;
export {};
//# sourceMappingURL=responder-roster.d.ts.map