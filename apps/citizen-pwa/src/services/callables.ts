import { httpsCallable } from 'firebase/functions'
import type { InboxPayload } from '@bantayog/shared-validators'
import { fns } from './firebase.js'

export interface SubmitCitizenReportInput {
  clientCreatedAt: number
  idempotencyKey: string
  publicRef: string
  secretHash: string
  correlationId: string
  payload: InboxPayload
}

export interface SubmitCitizenReportResult {
  reportId: string
  publicRef: string
  materialized: boolean
  replayed: boolean
}

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

export async function submitCitizenReport(
  input: SubmitCitizenReportInput,
): Promise<SubmitCitizenReportResult> {
  const callable = httpsCallable(fns(), 'submitCitizenReport')
  const result = await callable(input)
  const data = result.data as Record<string, unknown>
  if (
    typeof data.reportId !== 'string' ||
    typeof data.publicRef !== 'string' ||
    typeof data.materialized !== 'boolean' ||
    typeof data.replayed !== 'boolean'
  ) {
    throw new Error('invalid server response')
  }
  return {
    reportId: data.reportId,
    publicRef: data.publicRef,
    materialized: data.materialized,
    replayed: data.replayed,
  }
}

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
