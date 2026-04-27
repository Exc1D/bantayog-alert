import { type Firestore } from 'firebase-admin/firestore';
import { type Auth } from 'firebase-admin/auth';
interface BreakGlassInput {
    codeA: string;
    codeB: string;
    reason: string;
}
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