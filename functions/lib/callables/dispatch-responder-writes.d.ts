import type { Transaction, Firestore, DocumentReference } from 'firebase-admin/firestore';
import type { DispatchResponderCoreDeps } from './dispatch-responder-validation.js';
interface SmsPayload {
    recipientMsisdn: string;
    locale: 'tl' | 'en';
    publicRef: string;
}
interface BuildSmsPayloadArgs {
    db: Firestore;
    tx: Transaction;
    reportId: string;
    salt: string | undefined;
    defaultPublicRef: string;
}
export declare function buildSmsPayload(args: BuildSmsPayloadArgs): Promise<SmsPayload | null>;
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
    from: 'verified';
    to: 'assigned';
}
export declare function writeDispatchDocs(args: WriteDispatchDocsArgs): void;
export {};
//# sourceMappingURL=dispatch-responder-writes.d.ts.map