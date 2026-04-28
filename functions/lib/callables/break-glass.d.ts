import { type Firestore } from 'firebase-admin/firestore';
import { type Auth } from 'firebase-admin/auth';
import { z } from 'zod';
declare const breakGlassInputSchema: z.ZodObject<{
    codeA: z.ZodString;
    codeB: z.ZodString;
    reason: z.ZodString;
}, z.core.$strip>;
type BreakGlassInput = z.infer<typeof breakGlassInputSchema>;
export declare function initiateBreakGlassCore(db: Firestore, adminAuth: Auth, input: BreakGlassInput, actor: {
    uid: string;
}): Promise<{
    sessionId: string;
}>;
export declare const initiateBreakGlass: import("firebase-functions/https").CallableFunction<any, Promise<{
    sessionId: string;
}>, unknown>;
export declare function deactivateBreakGlassCore(db: Firestore, adminAuth: Auth, actor: {
    uid: string;
    claims: Record<string, unknown>;
}): Promise<void>;
export declare const deactivateBreakGlass: import("firebase-functions/https").CallableFunction<any, Promise<void>, unknown>;
export {};
//# sourceMappingURL=break-glass.d.ts.map