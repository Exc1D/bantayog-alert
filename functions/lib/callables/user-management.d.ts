import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
export declare const suspendUserSchema: z.ZodObject<{
    uid: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export declare const revokeUserSchema: z.ZodObject<{
    uid: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export declare const resetUserTotpSchema: z.ZodObject<{
    uid: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
interface SuspendUserDeps {
    uid: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: Record<string, unknown>;
    };
    now: Timestamp;
}
export declare function suspendUserCore(db: Firestore, auth: ReturnType<typeof getAuth>, deps: SuspendUserDeps): Promise<{
    uid: string;
    status: 'suspended';
}>;
interface RevokeUserDeps {
    uid: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: Record<string, unknown>;
    };
    now: Timestamp;
}
export declare function revokeUserCore(db: Firestore, auth: ReturnType<typeof getAuth>, deps: RevokeUserDeps): Promise<{
    uid: string;
    status: 'revoked';
}>;
interface ResetUserTotpDeps {
    uid: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: Record<string, unknown>;
    };
    now: Timestamp;
}
export declare function resetUserTotpCore(db: Firestore, auth: ReturnType<typeof getAuth>, deps: ResetUserTotpDeps): Promise<{
    uid: string;
    reset: true;
}>;
export declare const suspendUser: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    uid: string;
    status: "suspended";
}>, unknown>;
export declare const revokeUser: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    uid: string;
    status: "revoked";
}>, unknown>;
export declare const resetUserTotp: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    uid: string;
    reset: true;
}>, unknown>;
export {};
//# sourceMappingURL=user-management.d.ts.map