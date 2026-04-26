import { z } from 'zod';
import { type UserRole } from '@bantayog/shared-types';
declare const initiateSchema: z.ZodObject<{
    notes: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strip>;
declare const acceptSchema: z.ZodObject<{
    handoffId: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strip>;
export interface HandoffActor {
    uid: string;
    claims: {
        role: UserRole;
        municipalityId?: string;
        active: boolean;
        auth_time: number;
    };
}
export type InitiateResult = {
    success: true;
    handoffId: string;
} | {
    success: false;
    errorCode: string;
};
export type AcceptResult = {
    success: true;
} | {
    success: false;
    errorCode: string;
};
export declare function initiateShiftHandoffCore(db: FirebaseFirestore.Firestore, input: z.infer<typeof initiateSchema>, actor: HandoffActor, correlationId: string): Promise<InitiateResult>;
export declare function acceptShiftHandoffCore(db: FirebaseFirestore.Firestore, input: z.infer<typeof acceptSchema>, actor: HandoffActor, correlationId: string): Promise<AcceptResult>;
export declare const initiateShiftHandoff: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    success: true;
    handoffId: string;
}>, unknown>;
export declare const acceptShiftHandoff: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    success: true;
}>, unknown>;
export {};
//# sourceMappingURL=shift-handoff.d.ts.map