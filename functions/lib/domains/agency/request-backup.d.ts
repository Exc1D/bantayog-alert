import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
export declare const requestBackupSchema: z.ZodObject<{
    dispatchId: z.ZodString;
    reason: z.ZodString;
    idempotencyKey: z.ZodUUID;
}, z.core.$strict>;
export interface RequestBackupCoreDeps {
    dispatchId: string;
    reason: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role: string;
            municipalityId?: string;
        };
    };
    now: Timestamp;
}
export declare function requestBackupCore(db: Firestore, deps: RequestBackupCoreDeps): Promise<{
    status: 'requested';
    backupRequestId: string;
}>;
export declare const requestBackup: import("firebase-functions/https").CallableFunction<unknown, Promise<{
    status: "requested";
    backupRequestId: string;
}>, unknown>;
//# sourceMappingURL=request-backup.d.ts.map