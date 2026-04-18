// Cloud Functions v2 entry point.
export { setStaffClaims, suspendStaffAccount } from './auth/account-lifecycle.js'
export { withIdempotency, IdempotencyMismatchError } from './idempotency/guard.js'
export { requestUploadUrl } from './callables/request-upload-url.js'
export { requestLookup } from './callables/request-lookup.js'

// onMediaFinalize is lazily instantiated to avoid triggering Firebase Functions v2
// storage import-time env checks (FIREBASE_CONFIG) during unit testing.
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { getStorage } from 'firebase-admin/storage'
import { getFirestore } from 'firebase-admin/firestore'
import { onMediaFinalizeCore } from './triggers/on-media-finalize.js'

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
    await onMediaFinalizeCore({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bucket: bucket as any,
      objectName: event.data.name,
      writePending: async (payload) => {
        await db.collection('pending_media').doc(payload.uploadId).set(payload)
      },
    })
  },
)
