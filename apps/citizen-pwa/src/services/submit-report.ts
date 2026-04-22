import { normalizeMsisdn } from '@bantayog/shared-validators'
import type { Draft } from './draft-store'
import { draftStore } from './draft-store'

export interface SubmitReportInput {
  reportType: string
  severity: 'low' | 'medium' | 'high'
  description: string
  publicLocation: { lat: number; lng: number }
  photo?: Blob
  contact?: { phone: string; smsConsent: true }
}

export interface SubmitReportDeps {
  ensureSignedIn(): Promise<string>
  requestUploadUrl(input: {
    mimeType: string
    sizeBytes: number
    sha256: string
  }): Promise<{ uploadUrl: string; uploadId: string; storagePath: string; expiresAt: number }>
  putBlob(url: string, blob: Blob): Promise<void>
  writeInbox(doc: Record<string, unknown>): Promise<string>
  randomUUID(): string
  randomPublicRef(): string
  randomSecret(): string
  sha256Hex(input: string | Blob): Promise<string>
  now(): number
}

export interface SubmitReportResult {
  publicRef: string
  secret: string
  correlationId: string
}

export interface CreateDraftInput {
  reportType: Draft['reportType']
  barangay: string
  barangayId?: string
  description: string
  severity: Draft['severity']
  location?: { lat: number; lng: number }
  nearestLandmark?: string
  reporterName?: string
  reporterMsisdnHash?: string
  clientDraftRef: string
  photo?: Blob
}

export async function createDraft(input: CreateDraftInput): Promise<Draft> {
  const now = Date.now()
  const draft: Draft = {
    id: `BA-DA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    reportType: input.reportType,
    barangay: input.barangay,
    description: input.description,
    severity: input.severity,
    clientDraftRef: input.clientDraftRef,
    syncState: 'local_only',
    retryCount: 0,
    clientCreatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...(input.barangayId ? { barangayId: input.barangayId } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.nearestLandmark ? { nearestLandmark: input.nearestLandmark } : {}),
    ...(input.reporterName ? { reporterName: input.reporterName } : {}),
    ...(input.reporterMsisdnHash ? { reporterMsisdnHash: input.reporterMsisdnHash } : {}),
  }

  if (input.photo) {
    await draftStore.saveWithPhoto(draft, input.photo)
  } else {
    await draftStore.save(draft)
  }

  return draft
}

export async function submitReport(
  deps: SubmitReportDeps,
  input: SubmitReportInput,
): Promise<SubmitReportResult> {
  const reporterUid = await deps.ensureSignedIn()
  const correlationId = deps.randomUUID()
  const publicRef = deps.randomPublicRef()
  const secret = deps.randomSecret()
  const secretHash = await deps.sha256Hex(secret)
  const idempotencyKey = deps.randomUUID()
  const pendingMediaIds: string[] = []

  if (input.photo) {
    const sha = await deps.sha256Hex(input.photo)
    const signed = await deps.requestUploadUrl({
      mimeType: input.photo.type || 'image/jpeg',
      sizeBytes: input.photo.size,
      sha256: sha,
    })
    await deps.putBlob(signed.uploadUrl, input.photo)
    pendingMediaIds.push(signed.uploadId)
  }

  await deps.writeInbox({
    reporterUid,
    clientCreatedAt: deps.now(),
    idempotencyKey,
    publicRef,
    secretHash,
    correlationId,
    payload: {
      reportType: input.reportType,
      severity: input.severity,
      description: input.description,
      source: 'web',
      publicLocation: input.publicLocation,
      pendingMediaIds,
      ...(input.contact
        ? {
            contact: {
              phone: normalizeMsisdn(input.contact.phone),
              smsConsent: true as const,
            },
          }
        : {}),
    },
  })

  return { publicRef, secret, correlationId }
}
