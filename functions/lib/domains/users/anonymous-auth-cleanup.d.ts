import { type Auth } from 'firebase-admin/auth';
export interface AnonymousAuthCleanupInput {
    auth: Pick<Auth, 'listUsers' | 'deleteUsers'>;
    now?: () => number;
    ttlMs?: number;
    maxPages?: number;
    sleep?: (ms: number) => Promise<void>;
}
export interface AnonymousAuthCleanupResult {
    scanned: number;
    eligible: number;
    deleted: number;
    failed: number;
    pagesScanned: number;
    hasMore: boolean;
}
export declare function anonymousAuthCleanupCore(input: AnonymousAuthCleanupInput): Promise<AnonymousAuthCleanupResult>;
export declare const anonymousAuthCleanup: import("firebase-functions/scheduler").ScheduleFunction;
//# sourceMappingURL=anonymous-auth-cleanup.d.ts.map