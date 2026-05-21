import { z } from 'zod';
declare const initiateSchema: z.ZodObject<{
    toUid: z.ZodString;
    reason: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
declare const acceptSchema: z.ZodObject<{
    handoffId: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export interface ResponderHandoffActor {
    uid: string;
    claims: Record<string, unknown>;
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
export declare function initiateResponderHandoffCore(db: FirebaseFirestore.Firestore, input: z.infer<typeof initiateSchema>, actor: ResponderHandoffActor, correlationId: string): Promise<InitiateResult>;
export declare function acceptResponderHandoffCore(db: FirebaseFirestore.Firestore, input: z.infer<typeof acceptSchema>, actor: ResponderHandoffActor, correlationId: string): Promise<AcceptResult>;
export declare const initiateResponderHandoff: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    success: true;
    handoffId: string;
}>, unknown>;
export declare const acceptResponderHandoff: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    success: true;
}>, unknown>;
export {};
//# sourceMappingURL=responder-shift-handoff.d.ts.map