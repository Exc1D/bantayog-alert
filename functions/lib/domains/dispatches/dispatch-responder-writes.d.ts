import type { Transaction, DocumentReference } from 'firebase-admin/firestore';
import type { DispatchResponderCoreDeps } from './dispatch-responder-validation.js';
interface WriteDispatchDocsArgs {
    tx: Transaction;
    deps: DispatchResponderCoreDeps;
    dispatchRef: DocumentReference;
    reportRef: DocumentReference;
    reportEvRef: DocumentReference;
    dispatchEvRef: DocumentReference;
    responder: {
        agencyId: string;
        municipalityId: string;
    } & Record<string, unknown>;
    deadlineMs: number;
    correlationId: string;
    idempotencyPayloadHash: string;
    from: 'verified';
    to: 'assigned';
}
export declare function writeDispatchDocs(args: WriteDispatchDocsArgs): void;
export {};
//# sourceMappingURL=dispatch-responder-writes.d.ts.map