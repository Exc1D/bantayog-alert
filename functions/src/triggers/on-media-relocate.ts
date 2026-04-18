import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { getFirestore } from 'firebase-admin/firestore'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('onMediaRelocate')

export const onMediaRelocate = onObjectFinalized(
  { region: 'asia-southeast1', minInstances: 0, maxInstances: 20, timeoutSeconds: 60 },
  async (event) => {
    const flagSnap = await getFirestore().collection('system_config').doc('features').get()
    const enabled = flagSnap.exists
      ? Boolean(
          (flagSnap.data() as { media_canonical_migration?: { enabled?: unknown } } | undefined)
            ?.media_canonical_migration?.enabled,
        )
      : false
    if (!enabled) {
      log({
        severity: 'DEBUG',
        code: 'MEDIA_RELOCATE_SKIPPED_DISABLED',
        message: 'media_canonical_migration disabled, no-op',
      })
      return
    }
    log({
      severity: 'WARNING',
      code: 'MEDIA_RELOCATE_FLAG_ON_BUT_IMPL_ABSENT',
      message: 'flag enabled but relocation not implemented',
      data: { objectName: event.data.name },
    })
  },
)
