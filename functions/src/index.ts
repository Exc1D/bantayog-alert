// Cloud Functions v2 entry point.
export { setStaffClaims, suspendStaffAccount } from './domains/users/account-lifecycle.js'
export { registerCitizen } from './domains/users/callables.js'
export {
  withIdempotency,
  IdempotencyMismatchError,
  IdempotencyInProgressError,
} from './idempotency/guard.js'
export { requestUploadUrl } from './domains/media/callables.js'
export { verifyReport } from './domains/reports/verify-report.js'
export { unpublishReport } from './domains/reports/unpublish-report.js'
export { requestLookup } from './domains/reports/request-lookup.js'
export { submitCitizenReport } from './domains/reports/submit-citizen-report.js'
export { cancelReportByCitizen } from './domains/reports/cancel-report-by-citizen.js'
export { dispatchResponder } from './domains/dispatches/dispatch-responder.js'
export { cancelDispatch } from './domains/dispatches/cancel-dispatch.js'
export { rejectReport } from './domains/reports/reject-report.js'
export { acceptDispatch } from './domains/dispatches/accept-dispatch.js'
export { advanceDispatch } from './domains/dispatches/advance-dispatch.js'
export { declineDispatch } from './domains/dispatches/decline-dispatch.js'
export { escalateDispatch } from './domains/dispatches/escalate-dispatch.js'
export { getOpsMetrics } from './domains/ops/callables.js'
export { setCitizenContentVisibility } from './domains/ops/citizen-content-visibility.js'
export { closeReport } from './domains/reports/close-report.js'
export { submitResponderWitnessedReport } from './domains/reports/submit-responder-witnessed-report.js'
export { triggerSOS } from './domains/agency/trigger-sos.js'
export { requestBackup } from './domains/agency/request-backup.js'
export { markDispatchUnableToComplete } from './domains/dispatches/mark-dispatch-unable-to-complete.js'
export {
  suspendResponder,
  revokeResponder,
  bulkAvailabilityOverride,
} from './domains/users/responder-roster.js'
export {
  requestAgencyAssistance,
  acceptAgencyAssistance,
  declineAgencyAssistance,
} from './domains/agency/callables.js'
export { enterFieldMode, exitFieldMode } from './domains/agency/field-mode.js'
export { shareReport } from './domains/reports/share-report.js'
export { addCommandChannelMessage } from './domains/agency/command-channel-message.js'
export { borderAutoShareTrigger } from './domains/reports/border-auto-share.js'
export { duplicateClusterTrigger } from './domains/reports/duplicate-cluster-trigger.js'
export { mergeDuplicates } from './domains/reports/merge-duplicates.js'
export { initiateShiftHandoff, acceptShiftHandoff } from './domains/agency/shift-handoff.js'

export { subscribeToAlerts } from './domains/alerts/subscribe-to-alerts.js'
export { unsubscribeFromAlerts } from './domains/alerts/unsubscribe-to-alerts.js'

// onMediaFinalize is lazily instantiated to avoid triggering Firebase Functions v2
// storage import-time env checks (FIREBASE_CONFIG) during unit testing.
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getFirestore } from 'firebase-admin/firestore'
import { onMediaFinalizeCore, type FileHandle } from './domains/media/core.js'
import { processInboxItemCore } from './domains/reports/process-inbox-item.js'
import { BantayogError, logDimension } from '@bantayog/shared-validators'

const log = logDimension('index')

export const processInboxItem = onDocumentCreated(
  {
    document: 'report_inbox/{inboxId}',
    region: 'asia-southeast1',
    minInstances: 3,
    maxInstances: 100,
    timeoutSeconds: 30,
    memory: '512MiB',
  },
  async (event) => {
    try {
      await processInboxItemCore({ db: getFirestore(), inboxId: event.params.inboxId })
    } catch (err: unknown) {
      if (err instanceof BantayogError) {
        log({
          severity: 'ERROR',
          code: err.code,
          message: `processInboxItem failed for inbox ${event.params.inboxId}: ${err.message}`,
        })
        return // terminal error — do not retry
      }
      throw err // unexpected error — retry
    }
  },
)

export const onMediaFinalize = onObjectFinalized(
  {
    region: 'asia-southeast1',
    minInstances: 1,
    maxInstances: 50,
    timeoutSeconds: 60,
    memory: '1GiB',
  },
  async (event) => {
    const bucket = getStorage().bucket(event.data.bucket)
    const db = getFirestore()
    try {
      await onMediaFinalizeCore({
        bucket: bucket as unknown as { file(name: string): FileHandle },
        objectName: event.data.name,
        now: () => Date.now(),
        writePending: async (payload) => {
          await db.collection('pending_media').doc(payload.uploadId).set(payload)
        },
      })
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? (err as { code?: string }).code
          : undefined
      if (code === 'MEDIA_REJECTED_MIME' || code === 'MEDIA_REJECTED_CORRUPT') {
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      log({
        severity: 'ERROR',
        code: 'MEDIA_FINALIZE_FAILED',
        message: `onMediaFinalize failed: ${message}`,
      })
      throw err
    }
  },
)

export { inboxReconciliationSweep } from './domains/reports/inbox-reconciliation-sweep.js'
export { dispatchMirrorToReport } from './domains/reports/dispatch-mirror-to-report.js'
export { adminOperationsSweep } from './domains/ops/admin-operations-sweep.js'
export { projectResponderLocations } from './domains/ops/project-responder-locations.js'
export { analyticsSnapshotWriter } from './domains/ops/analytics-snapshot-writer.js'
export { costSnapshotWriter } from './domains/ops/cost-snapshot-writer.js'
export { auditExportBatch } from './domains/ops/audit-export-batch.js'
export { auditExportHealthCheck } from './domains/ops/audit-export-health-check.js'
export { declareAlert } from './domains/alerts/callables.js'
export { declareDataIncident } from './domains/alerts/declare-data-incident.js'
export { recordIncidentResponseEvent } from './domains/agency/incident-response-event.js'
export { setRetentionExempt } from './domains/erasure/set-retention-exempt.js'
export { approveErasureRequest } from './domains/erasure/approve-erasure-request.js'
export { requestDataErasure } from './domains/erasure/request-data-erasure.js'
export { requestDataExport } from './domains/erasure/request-data-export.js'
export { setErasureLegalHold } from './domains/erasure/set-erasure-legal-hold.js'
export { erasureSweep } from './domains/erasure/erasure-sweep.js'
export { retentionSweep } from './domains/erasure/retention-sweep.js'
export { toggleMutualAidVisibility } from './domains/agency/toggle-mutual-aid.js'
export {
  upsertProvincialResource,
  archiveProvincialResource,
} from './domains/ops/provincial-resources.js'
export { createUser } from './domains/users/create-user.js'
export { createResponder } from './domains/users/create-responder.js'
export { redispatchReport } from './domains/dispatches/redispatch-report.js'
export { reopenReport } from './domains/reports/reopen-report.js'
export { monitorDispatchDeadlines } from './domains/dispatches/monitor-dispatch-deadlines.js'
export { retryFcmDelivery } from './domains/dispatches/retry-fcm-delivery.js'
export { suspendUser, revokeUser, resetUserTotp } from './domains/users/user-management.js'
export { anonymousAuthCleanup } from './domains/users/anonymous-auth-cleanup.js'
export { deleteOwnAnonymousAccount } from './domains/users/delete-own-anonymous-account.js'
