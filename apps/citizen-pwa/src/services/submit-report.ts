import { normalizeMsisdn } from '@bantayog/shared-validators'

export interface SubmitReportInput {
  reportType: string
  severity: 'low' | 'medium' | 'high'
  description: string
  publicLocation: { lat: number; lng: number }
  photo?: Blob
  contact?: { phone: string; smsConsent: true }
  municipalityId?: string
  barangayId?: string
  nearestLandmark?: string
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
      ...(input.municipalityId
        ? {
            municipalityId: input.municipalityId,
            barangayId: input.barangayId,
            nearestLandmark: input.nearestLandmark,
          }
        : {}),
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
