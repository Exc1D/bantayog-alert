import { normalizeMsisdn } from '@bantayog/shared-validators'
import type { ReportType } from '@bantayog/shared-types'
import type { Draft } from './draft-store'
import { draftStore } from './draft-store'

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

export interface CreateDraftInput {
  reportType: Draft['reportType']
  barangay: string
  barangayId?: string
  description: string
  severity: Draft['severity']
  location?: { lat: number; lng: number }
  nearestLandmark?: string
  clientDraftRef: string
  municipalityId?: string
  photo?: Blob
}

const VALID_REPORT_TYPES: readonly string[] = [
  'flood',
  'fire',
  'earthquake',
  'typhoon',
  'landslide',
  'storm_surge',
  'medical',
  'accident',
  'structural',
  'security',
  'other',
]

function canonicalizeReportType(reportType: string): ReportType {
  // The citizen UI still carries a legacy "public_disturbance" alias, but the
  // shared report schemas only accept "security".
  if (reportType === 'public_disturbance') {
    return 'security'
  }
  if (!VALID_REPORT_TYPES.includes(reportType)) {
    throw new Error(`Unsupported report type: ${reportType}`)
  }
  return reportType as ReportType
}

function randomPublicRef(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const buf = new Uint8Array(8)
  crypto.getRandomValues(buf)
  return Array.from(buf)
    .map((b) => chars[b % chars.length])
    .join('')
}

function randomSecret(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return Array.from(buf)
    .map((b) => chars[b % chars.length])
    .join('')
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createDraft(
  input: CreateDraftInput,
): Promise<{ draft: Draft; secret: string }> {
  const now = Date.now()
  const reportType = canonicalizeReportType(input.reportType)
  const publicRef = randomPublicRef()
  const secret = randomSecret()
  const secretHash = await sha256Hex(secret)
  const correlationId = crypto.randomUUID()
  const idempotencyKey = crypto.randomUUID()

  const draft: Draft = {
    id: `BA-DA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    reportType,
    barangay: input.barangay,
    description: input.description,
    severity: input.severity,
    clientDraftRef: input.clientDraftRef,
    publicRef,
    secretHash,
    correlationId,
    idempotencyKey,
    syncState: 'local_only',
    retryCount: 0,
    clientCreatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...(input.barangayId ? { barangayId: input.barangayId } : {}),
    ...(input.municipalityId ? { municipalityId: input.municipalityId } : {}),
    ...(input.location ? { location: input.location } : {}),
    ...(input.nearestLandmark ? { nearestLandmark: input.nearestLandmark } : {}),
  }

  if (input.photo) {
    await draftStore.saveWithPhoto(draft, input.photo)
  } else {
    await draftStore.save(draft)
  }

  return { draft, secret }
}

export async function submitReport(
  deps: SubmitReportDeps,
  input: SubmitReportInput,
): Promise<SubmitReportResult> {
  const reporterUid = await deps.ensureSignedIn()
  const reportType = canonicalizeReportType(input.reportType)
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
      reportType,
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
