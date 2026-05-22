import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  BantayogError,
  BantayogErrorCode,
  inboxPayloadSchema,
  type InboxPayload,
} from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { withIdempotency } from '../../idempotency/guard.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { bantayogErrorToHttps } from '../shared/https-error.js'
import { checkRateLimit } from '../shared/rate-limit.js'
import { reverseGeocodeToMunicipality } from '../shared/geocode.js'
import {
  materializeCitizenReportCore,
  type CitizenReportMaterializationResult,
} from './process-inbox-item.js'

export const submitCitizenReportSchema = z
  .object({
    clientCreatedAt: z.number().int(),
    idempotencyKey: z.string().min(1),
    publicRef: z.string().regex(/^[a-z0-9]{8}$/),
    secretHash: z.string().regex(/^[a-f0-9]{64}$/),
    correlationId: z.uuid(),
    payload: inboxPayloadSchema,
  })
  .strict()

export interface SubmitCitizenReportCoreInput {
  reporterUid: string
  clientCreatedAt: number
  idempotencyKey: string
  publicRef: string
  secretHash: string
  correlationId: string
  payload: InboxPayload
  now?: () => number
}

async function resolveMunicipality(
  db: Firestore,
  payload: InboxPayload,
): Promise<{ municipalityId: string; municipalityLabel: string; barangayId: string }> {
  if (!payload.publicLocation) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'location missing from payload')
  }

  if (payload.municipalityId) {
    const muniSnap = await db.collection('municipalities').doc(payload.municipalityId).get()
    if (!muniSnap.exists) {
      throw new BantayogError(
        BantayogErrorCode.MUNICIPALITY_NOT_FOUND,
        `Municipality '${payload.municipalityId}' is not in jurisdiction.`,
      )
    }
    const muniData = muniSnap.data() as { label?: unknown } | undefined
    return {
      municipalityId: payload.municipalityId,
      municipalityLabel:
        typeof muniData?.label === 'string' ? muniData.label : payload.municipalityId,
      barangayId: payload.barangayId ?? 'unknown',
    }
  }

  const geo = await reverseGeocodeToMunicipality(db, payload.publicLocation)
  if (!geo) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'out of jurisdiction')
  }
  return geo
}

export async function submitCitizenReportCore(
  db: Firestore,
  input: SubmitCitizenReportCoreInput,
): Promise<CitizenReportMaterializationResult> {
  const now = input.now ?? (() => Date.now())
  const { result, fromCache } = await withIdempotency<
    Omit<SubmitCitizenReportCoreInput, 'now'>,
    CitizenReportMaterializationResult
  >(
    db,
    {
      key: `submitCitizenReport:${input.reporterUid}:${input.idempotencyKey}`,
      payload: {
        reporterUid: input.reporterUid,
        clientCreatedAt: input.clientCreatedAt,
        idempotencyKey: input.idempotencyKey,
        publicRef: input.publicRef,
        secretHash: input.secretHash,
        correlationId: input.correlationId,
        payload: input.payload,
      },
      now,
    },
    async () => {
      const resolved = await resolveMunicipality(db, input.payload)
      return materializeCitizenReportCore({
        db,
        reporterUid: input.reporterUid,
        clientCreatedAt: input.clientCreatedAt,
        publicRef: input.publicRef,
        secretHash: input.secretHash,
        correlationId: input.correlationId,
        payload: input.payload,
        municipalityId: resolved.municipalityId,
        municipalityLabel: resolved.municipalityLabel,
        barangayId: resolved.barangayId,
        now,
      })
    },
  )

  return { ...result, replayed: fromCache || result.replayed }
}

export const submitCitizenReport = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 50,
    timeoutSeconds: 15,
    minInstances: 1,
  },
  async (request: CallableRequest<unknown>) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const parsed = submitCitizenReportSchema.safeParse(request.data)
    if (!parsed.success) throw new HttpsError('invalid-argument', 'malformed payload')

    const now = Timestamp.now()
    const rateLimit = await checkRateLimit(adminDb, {
      key: `submitCitizenReport:${request.auth.uid}`,
      limit: 30,
      windowSeconds: 60,
      now,
    })
    if (!rateLimit.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit exceeded', {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      })
    }

    try {
      return await submitCitizenReportCore(adminDb, {
        reporterUid: request.auth.uid,
        clientCreatedAt: parsed.data.clientCreatedAt,
        idempotencyKey: parsed.data.idempotencyKey,
        publicRef: parsed.data.publicRef,
        secretHash: parsed.data.secretHash,
        correlationId: parsed.data.correlationId,
        payload: parsed.data.payload,
        now: () => now.toMillis(),
      })
    } catch (err: unknown) {
      if (err instanceof BantayogError) throw bantayogErrorToHttps(err)
      throw err
    }
  },
)
