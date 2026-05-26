import { createHash } from 'node:crypto'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'
import { bantayogErrorToHttps } from '../shared/https-error.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { checkRateLimit } from '../shared/rate-limit.js'
import { getCitizenCallableCorsOrigins } from '../shared/callable-config.js'

const payloadSchema = z.union([
  z
    .object({
      publicRef: z.string().regex(/^[a-z0-9]{8}$/),
      secret: z.string().min(1).max(64),
    })
    .strict(),
  z
    .object({
      secret: z.string().min(1).max(64),
    })
    .strict(),
])

export interface RequestLookupInput {
  db: Firestore
  data: unknown
  auth?: { uid: string } | undefined
}

export interface RequestLookupResult {
  publicRef: string
  status: string
  lastStatusAt: number
  municipalityLabel: string
}

export async function requestLookupImpl(input: RequestLookupInput): Promise<RequestLookupResult> {
  const parsed = payloadSchema.safeParse(input.data)
  if (!parsed.success) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Invalid lookup request payload.')
  }

  const data = parsed.data
  const secretOnlyPath = !('publicRef' in data)
  const secretHash = createHash('sha256').update(data.secret).digest('hex')

  let resolvedPublicRef: string
  let reportId: string

  if (secretOnlyPath) {
    if (input.auth === undefined) {
      throw new BantayogError(
        BantayogErrorCode.UNAUTHORIZED,
        'Authentication required for secret-only lookup.',
      )
    }

    const secretSnap = await input.db.collection('secret_lookup').doc(secretHash).get()
    if (!secretSnap.exists) {
      throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Unknown secret.')
    }

    const secretDoc = secretSnap.data()
    if (
      !secretDoc ||
      typeof secretDoc.publicRef !== 'string' ||
      typeof secretDoc.reportId !== 'string' ||
      typeof secretDoc.expiresAt !== 'number'
    ) {
      console.error('[requestLookup] secret_lookup doc malformed:', { secretHash, secretDoc })
      throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Invalid secret record.')
    }
    if (secretDoc.expiresAt < Date.now()) {
      throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Secret expired.')
    }

    resolvedPublicRef = secretDoc.publicRef
    reportId = secretDoc.reportId
  } else {
    const { publicRef } = data
    resolvedPublicRef = publicRef

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
    if (secretHash !== lookup.tokenHash) {
      throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Secret mismatch.')
    }

    reportId = lookup.reportId
  }

  const reportSnap = await input.db.collection('reports').doc(reportId).get()
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
    publicRef: resolvedPublicRef,
    status: report.status ?? 'unknown',
    lastStatusAt: report.updatedAt ?? report.submittedAt ?? 0,
    municipalityLabel: report.municipalityLabel ?? 'Unknown',
  }
}

export const requestLookup = onCall(
  {
    cors: getCitizenCallableCorsOrigins(),
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
  },
  async (request) => {
    const rlKey = request.auth?.uid ?? `anon:${request.rawRequest.ip ?? 'unknown'}`
    const rl = await checkRateLimit(getFirestore(), {
      key: `requestLookup:${rlKey}`,
      limit: 30,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit exceeded')
    }
    try {
      return await requestLookupImpl({
        db: getFirestore(),
        data: request.data,
        auth: request.auth ?? undefined,
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) {
        throw bantayogErrorToHttps(err)
      }
      console.error('requestLookup failed:', err)
      throw new HttpsError('internal', 'Lookup failed.')
    }
  },
)
