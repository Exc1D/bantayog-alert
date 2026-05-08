import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const requestProvincialEscalationSchema: z.ZodObject<{
    dispatchId: z.ZodString;
    reason: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodString;
}, z.core.$strict>;
export interface RequestProvincialEscalationCoreDeps {
    dispatchId: string;
    reason: string;
    notes?: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role?: string;
            agencyId?: string;
        };
    };
    now: Timestamp;
}
export declare function requestProvincialEscalationCore(db: Firestore, deps: RequestProvincialEscalationCoreDeps): Promise<{
    escalationId: string;
    status: 'pending';
}>;
export declare const requestProvincialEscalation: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    escalationId: string;
    status: "pending";
}>, unknown>;
//# sourceMappingURL=request-provincial-escalation.d.ts.map