import { onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { requireAuth } from './https-error.js'

export const requestDataExport = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  (request) => {
    const { uid } = requireAuth(request, ['citizen'])
    logger.info(`Data export requested by ${uid}`)
    return { status: 'queued' }
  },
)
