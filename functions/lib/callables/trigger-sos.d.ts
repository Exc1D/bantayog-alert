import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const triggerSosSchema: z.ZodObject<{
    dispatchId: z.ZodString;
}, z.core.$strict>;
export interface TriggerSosCoreDeps {
    dispatchId: string;
    actor: {
        uid: string;
        claims: {
            role: string;
            municipalityId?: string;
        };
    };
    now: Timestamp;
}
export declare function triggerSosCore(db: Firestore, deps: TriggerSosCoreDeps): Promise<{
    status: 'sos_triggered';
    dispatchId: string;
}>;
export declare const triggerSOS: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "sos_triggered";
    dispatchId: string;
}>, unknown>;
//# sourceMappingURL=trigger-sos.d.ts.map