import { type Firestore } from 'firebase-admin/firestore';
export interface CleanupArgs {
    db: Firestore;
    now: () => number;
}
export declare function cleanupSmsMinuteWindowsCore({ db, now }: CleanupArgs): Promise<void>;
export declare const cleanupSmsMinuteWindows: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=cleanup-sms-minute-windows.d.ts.map