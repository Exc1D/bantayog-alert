import type { Firestore } from 'firebase-admin/firestore';
export type CircuitState = 'closed' | 'open' | 'half_open';
export declare class NoProviderAvailableError extends Error {
    constructor();
}
export declare function readCircuitState(db: Firestore, providerId: 'semaphore' | 'globelabs'): Promise<CircuitState>;
export declare function pickProvider(db: Firestore): Promise<'semaphore' | 'globelabs'>;
export interface IncrementOutcome {
    success: boolean;
    rateLimited: boolean;
    latencyMs: number;
}
export declare function incrementMinuteWindow(db: Firestore, providerId: 'semaphore' | 'globelabs', outcome: IncrementOutcome, nowMs: number): Promise<void>;
//# sourceMappingURL=sms-health.d.ts.map