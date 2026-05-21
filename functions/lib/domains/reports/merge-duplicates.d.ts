import { z } from 'zod';
import type { UserRole } from '@bantayog/shared-types';
declare const inputSchema: z.ZodObject<{
    primaryReportId: z.ZodString;
    duplicateReportIds: z.ZodArray<z.ZodString>;
    idempotencyKey: z.ZodUUID;
}, z.core.$strip>;
export interface MergeDuplicatesActor {
    uid: string;
    claims: {
        role: UserRole;
        municipalityId?: string;
        active: boolean;
        auth_time: number;
    };
}
export type MergeDuplicatesResult = {
    success: true;
    mergedCount: number;
} | {
    success: false;
    errorCode: string;
};
export declare function mergeDuplicatesCore(db: FirebaseFirestore.Firestore, input: z.infer<typeof inputSchema>, actor: MergeDuplicatesActor, correlationId?: `${string}-${string}-${string}-${string}-${string}`): Promise<MergeDuplicatesResult>;
export declare const mergeDuplicates: import("firebase-functions/https").CallableFunction<unknown, Promise<MergeDuplicatesResult>, unknown>;
export {};
//# sourceMappingURL=merge-duplicates.d.ts.map