import { Timestamp } from 'firebase-admin/firestore';
export interface FieldModeActorClaims {
    role: string;
    accountStatus: string;
    municipalityId?: string;
    auth_time: number;
}
export interface EnterFieldModeCoreResult {
    status: 'entered';
    expiresAt: number;
}
export interface ExitFieldModeCoreResult {
    status: 'exited';
}
export declare function enterFieldModeCore(db: FirebaseFirestore.Firestore, deps: {
    actor: {
        uid: string;
        claims: FieldModeActorClaims;
    };
    now: Timestamp;
}): Promise<EnterFieldModeCoreResult>;
export declare function exitFieldModeCore(db: FirebaseFirestore.Firestore, deps: {
    actor: {
        uid: string;
        claims: {
            role: string;
            accountStatus: string;
            municipalityId?: string;
        };
    };
    now: Timestamp;
}): Promise<ExitFieldModeCoreResult>;
export declare const enterFieldMode: import("firebase-functions/https").CallableFunction<unknown, Promise<EnterFieldModeCoreResult>, unknown>;
export declare const exitFieldMode: import("firebase-functions/https").CallableFunction<unknown, Promise<ExitFieldModeCoreResult>, unknown>;
//# sourceMappingURL=enter-field-mode.d.ts.map