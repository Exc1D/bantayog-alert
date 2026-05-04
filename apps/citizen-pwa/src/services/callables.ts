import { httpsCallable } from 'firebase/functions'
import { fns } from './firebase.js'

export async function requestDataExport(): Promise<{
  downloadUrl: string
  expiresAt: number
  reportCount: number
  mediaCount: number
}> {
  const callable = httpsCallable(fns(), 'requestDataExport')
  const result = await callable()
  const data = result.data as Record<string, unknown>
  if (
    typeof data.downloadUrl !== 'string' ||
    typeof data.expiresAt !== 'number' ||
    typeof data.reportCount !== 'number' ||
    typeof data.mediaCount !== 'number'
  ) {
    throw new Error('invalid server response')
  }
  return {
    downloadUrl: data.downloadUrl,
    expiresAt: data.expiresAt,
    reportCount: data.reportCount,
    mediaCount: data.mediaCount,
  }
}

export async function registerCitizen(): Promise<{
  uid: string
  role: string
  accountStatus: string
}> {
  const callable = httpsCallable(fns(), 'registerCitizen')
  try {
    const result = await callable()
    const data = result.data as Record<string, unknown>
    if (
      typeof data.uid !== 'string' ||
      typeof data.role !== 'string' ||
      typeof data.accountStatus !== 'string'
    ) {
      throw new Error('invalid server response')
    }
    return { uid: data.uid, role: data.role, accountStatus: data.accountStatus }
  } catch (err) {
    throw new Error(
      `Citizen registration failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
}

const idempotencyKeys = new Map<string, string>()

export async function cancelReport(reportId: string): Promise<void> {
  let key = idempotencyKeys.get(reportId)
  if (!key) {
    key = crypto.randomUUID()
    idempotencyKeys.set(reportId, key)
  }
  const callable = httpsCallable(fns(), 'cancelReportByCitizen')
  try {
    await callable({ reportId, idempotencyKey: key })
  } finally {
    idempotencyKeys.delete(reportId)
  }
}
