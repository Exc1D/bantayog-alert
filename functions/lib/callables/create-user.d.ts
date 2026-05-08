import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const createUserSchema: z.ZodObject<{
    displayName: z.ZodString;
    phone: z.ZodString;
    role: z.ZodEnum<{
        responder: "responder";
        municipal_admin: "municipal_admin";
        agency_admin: "agency_admin";
        provincial_superadmin: "provincial_superadmin";
    }>;
    municipalityId: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodOptional<z.ZodString>;
    specializations: z.ZodOptional<z.ZodArray<z.ZodString>>;
    idempotencyKey: z.ZodString;
}, z.core.$strict>;
export interface CreateUserCoreDeps {
    displayName: string;
    phone: string;
    role: 'municipal_admin' | 'agency_admin' | 'responder' | 'provincial_superadmin';
    municipalityId?: string;
    agencyId?: string;
    specializations?: string[];
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: Record<string, unknown>;
    };
    now: Timestamp;
}
export declare function createUserCore(db: Firestore, deps: CreateUserCoreDeps): Promise<{
    uid: string;
    role: string;
    accountStatus: 'active';
}>;
export declare const createUser: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    uid: string;
    role: string;
    accountStatus: "active";
}>, unknown>;
//# sourceMappingURL=create-user.d.ts.map