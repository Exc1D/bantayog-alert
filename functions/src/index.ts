// Cloud Functions v2 entry point.
export { setStaffClaims, suspendStaffAccount } from './auth/account-lifecycle.js'
export { withIdempotency, IdempotencyMismatchError } from './idempotency/guard.js'
export { requestUploadUrl } from './callables/request-upload-url.js'
export { verifyReport } from './callables/verify-report.js'
export { requestLookup } from './callables/request-lookup.js'
export { dispatchResponder } from './callables/dispatch-responder.js'
export { cancelDispatch } from './callables/cancel-dispatch.js'
export { rejectReport } from './callables/reject-report.js'
export { acceptDispatch } from './callables/accept-dispatch.js'
export { closeReport } from './callables/close-report.js'

// onMediaFinalize is lazily instantiated to avoid triggering Firebase Functions v2
// storage import-time env checks (FIREBASE_CONFIG) during unit testing.
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getFirestore } from 'firebase-admin/firestore'
import { onMediaFinalizeCore, type FileHandle } from './triggers/on-media-finalize.js'
import { processInboxItemCore } from './triggers/process-inbox-item.js'
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
    } catch (err) {
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
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'MEDIA_REJECTED_MIME' || code === 'MEDIA_REJECTED_CORRUPT') {
        return
      }
      log({
        severity: 'ERROR',
        code: 'MEDIA_FINALIZE_FAILED',
        message: `onMediaFinalize failed: ${(err as Error).message}`,
      })
      throw err
    }
  },
)

export { onMediaRelocate } from './triggers/on-media-relocate.js'
export { inboxReconciliationSweep } from './triggers/inbox-reconciliation-sweep.js'
export { dispatchMirrorToReport } from './triggers/dispatch-mirror-to-report.js'
