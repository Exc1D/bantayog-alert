import type { Firestore, Timestamp } from 'firebase-admin/firestore';
export interface RateLimitCheck {
    key: string;
    limit: number;
    windowSeconds: number;
    now: Timestamp;
    updatedAt?: Timestamp | number;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
}
export declare function checkRateLimit(db: Firestore, { key, limit, windowSeconds, now, updatedAt }: RateLimitCheck): Promise<RateLimitResult>;
//# sourceMappingURL=rate-limit.d.ts.map