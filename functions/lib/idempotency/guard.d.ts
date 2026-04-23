import type { Firestore } from 'firebase-admin/firestore';
export declare class IdempotencyMismatchError extends Error {
    readonly key: string;
    readonly firstSeenAt: number;
    constructor(key: string, firstSeenAt: number);
}
interface WithIdempotencyOptions<TPayload> {
    key: string;
    payload: TPayload;
    now?: () => number;
}
export declare function withIdempotency<TPayload, TResult>(db: Firestore, opts: WithIdempotencyOptions<TPayload>, op: () => Promise<TResult>): Promise<{
    result: TResult;
    fromCache: boolean;
}>;
export {};
//# sourceMappingURL=guard.d.ts.map