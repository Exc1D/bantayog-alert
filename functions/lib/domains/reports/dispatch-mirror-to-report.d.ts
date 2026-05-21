/**
 * dispatch-mirror-to-report.ts
 *
 * Cloud Function v2 Firestore trigger (onDocumentWritten) that mirrors
 * dispatch state progression back to the parent report document.
 *
 * The pure helper `computeMirrorAction` is the decision function tested in
 * the unit tests. The trigger body (logger placeholder) is implemented
 * in Task 12.
 */
import type { Firestore } from 'firebase-admin/firestore';
import type { DispatchStatus, ReportStatus } from '@bantayog/shared-validators';
export type MirrorAction = {
    action: 'skip';
    reason: string;
} | {
    action: 'update';
    to: ReportStatus;
};
/**
 * Pure decision function: given the before/after dispatch status and the
 * current report status, decide whether to skip or emit an update.
 *
 * Returns:
 * - `{ action: 'skip', reason: 'noop_same_status' }` when before === after
 * - `{ action: 'skip', reason: 'cancel_owned_by_callable' }` when after is 'cancelled'
 * - `{ action: 'skip', reason: 'no_mirror_for_<status>' }` when dispatchToReportState returns null
 * - `{ action: 'skip', reason: 'already_at_target' }` when mapped status === currentReportStatus
 * - `{ action: 'update', to: ReportStatus }` when a status write is needed
 */
export declare function computeMirrorAction(before: DispatchStatus | undefined, after: DispatchStatus | undefined, currentReportStatus: ReportStatus): MirrorAction;
export interface DispatchMirrorToReportCoreParams {
    db: Firestore;
    dispatchId: string;
    beforeData: {
        status?: DispatchStatus;
        correlationId?: string;
    } | undefined;
    afterData: {
        status?: DispatchStatus;
        reportId?: string;
        correlationId?: string;
    } | undefined;
}
/**
 * Core logic for dispatchMirrorToReport.
 * Exported for direct unit testing with firebase-functions-test.
 */
export declare function dispatchMirrorToReportCore(params: DispatchMirrorToReportCoreParams): Promise<void>;
export declare const dispatchMirrorToReport: import("firebase-functions").CloudFunction<import("firebase-functions/firestore").FirestoreEvent<import("firebase-functions").Change<import("firebase-functions/firestore").DocumentSnapshot> | undefined, {
    dispatchId: string;
}>>;
//# sourceMappingURL=dispatch-mirror-to-report.d.ts.map