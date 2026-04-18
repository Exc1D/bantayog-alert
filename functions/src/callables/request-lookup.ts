import { createHash } from 'node:crypto'
import { onCall } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'

const payloadSchema = z
  .object({
    publicRef: z.string().regex(/^[a-z0-9]{8}$/),
    secret: z.string().min(1).max(64),
  })
  .strict()

export interface RequestLookupInput {
  db: Firestore
  data: unknown
}

export interface RequestLookupResult {
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

export async function requestLookupImpl(input: RequestLookupInput): Promise<RequestLookupResult> {
  const parsed = payloadSchema.safeParse(input.data)
  if (!parsed.success) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Invalid lookup request payload.')
  }

  const { publicRef, secret } = parsed.data

  const lookupSnap = await input.db.collection('report_lookup').doc(publicRef).get()
  if (!lookupSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Unknown reference.')
  }

  const lookup = lookupSnap.data() as {
    reportId: string
    tokenHash: string
    expiresAt: number
  }

  if (lookup.expiresAt < Date.now()) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Reference expired.')
  }

  const secretHash = createHash('sha256').update(secret).digest('hex')
  if (secretHash !== lookup.tokenHash) {
    throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Secret mismatch.')
  }

  const reportSnap = await input.db.collection('reports').doc(lookup.reportId).get()
  if (!reportSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found.')
  }

  const report = reportSnap.data() as {
    status?: string
    municipalityLabel?: string
    submittedAt?: number
    updatedAt?: number
  }

  return {
    status: report.status ?? 'unknown',
    lastStatusAt: report.updatedAt ?? report.submittedAt ?? 0,
    municipalityLabel: report.municipalityLabel ?? 'Unknown',
  }
}

export const requestLookup = onCall(async (request) => {
  try {
    return await requestLookupImpl({
      db: getFirestore(),
      data: request.data,
    })
  } catch (err: unknown) {
    if (err instanceof BantayogError) {
      throw err
    }
    throw new BantayogError(
      BantayogErrorCode.INTERNAL_ERROR,
      err instanceof Error ? err.message : 'Unknown error',
    )
  }
})
