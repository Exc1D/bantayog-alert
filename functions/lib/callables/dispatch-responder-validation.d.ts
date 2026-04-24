import type { Database } from 'firebase-admin/database';
import type { Transaction, Timestamp } from 'firebase-admin/firestore';
export interface DispatchResponderCoreDeps {
    reportId: string;
    responderUid: string;
    idempotencyKey: string;
    actor: {
        uid: string;
        claims: {
            role?: string;
            municipalityId?: string;
            permittedMunicipalityIds?: string[];
        };
    };
    now: Timestamp;
}
interface AssertResponderOnShiftOptions {
    rtdb: Database;
    municipalityId: string;
    responderUid: string;
    message?: string;
}
export declare function assertResponderOnShift({ rtdb, municipalityId, responderUid, message, }: AssertResponderOnShiftOptions): Promise<void>;
interface ValidateDispatchTransactionArgs {
    tx: Transaction;
    rtdb: Database;
    deps: DispatchResponderCoreDeps;
    reportRef: FirebaseFirestore.DocumentReference;
    responderRef: FirebaseFirestore.DocumentReference;
}
export declare function validateDispatchTransaction({ tx, rtdb, deps, reportRef, responderRef, }: ValidateDispatchTransactionArgs): Promise<{
    report: Record<string, unknown>;
    responder: {
        agencyId: string;
        municipalityId: string;
    } & Record<string, unknown>;
    from: 'verified';
}>;
export {};
//# sourceMappingURL=dispatch-responder-validation.d.ts.map