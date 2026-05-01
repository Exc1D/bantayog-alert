import { type Firestore } from 'firebase-admin/firestore';
import { type Auth } from 'firebase-admin/auth';
export interface SweepExpiredBreakGlassSessionsInput {
    db: Firestore;
    auth: Auth;
    now?: () => number;
}
export interface SweepExpiredBreakGlassSessionsResult {
    expired: number;
    failed: number;
}
export declare function sweepExpiredBreakGlassSessionsCore(input: SweepExpiredBreakGlassSessionsInput): Promise<SweepExpiredBreakGlassSessionsResult>;
export declare const sweepExpiredBreakGlassSessions: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=sweep-expired-break-glass-sessions.d.ts.map