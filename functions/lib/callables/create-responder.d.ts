import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const createResponderSchema: z.ZodObject<{
    displayName: z.ZodString;
    phone: z.ZodString;
    municipalityId: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodString;
    specializations: z.ZodOptional<z.ZodArray<z.ZodString>>;
    idempotencyKey: z.ZodString;
}, z.core.$strict>;
export interface CreateResponderCoreDeps {
    displayName: string;
    phone: string;
    municipalityId?: string;
    agencyId: string;
    specializations?: string[];
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: Record<string, unknown>;
    };
    now: Timestamp;
}
export declare function createResponderCore(db: Firestore, deps: CreateResponderCoreDeps): Promise<{
    uid: string;
    agencyId: string;
    availabilityStatus: 'available';
}>;
export declare const createResponder: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    uid: string;
    agencyId: string;
    availabilityStatus: "available";
}>, unknown>;
//# sourceMappingURL=create-responder.d.ts.map