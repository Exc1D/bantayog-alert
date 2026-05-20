import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { type DispatchStatus } from '@bantayog/shared-validators';
export interface MirrorDispatchStatusToReportArgs {
    db: Firestore;
    tx: Transaction;
    dispatchId: string;
    reportId: string | undefined;
    afterStatus: DispatchStatus;
    actorUid: string;
    actorRole: 'responder';
    nowMillis: number;
    correlationId: string;
}
export declare function mirrorDispatchStatusToReportInTransaction(args: MirrorDispatchStatusToReportArgs): Promise<void>;
//# sourceMappingURL=dispatch-report-mirror.d.ts.map