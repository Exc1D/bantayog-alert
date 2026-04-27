import type { Firestore } from 'firebase-admin/firestore'
import { canonicalPayloadHash } from '@bantayog/shared-validators'

export class IdempotencyMismatchError extends Error {
  constructor(
    public readonly key: string,
    public readonly firstSeenAt: number,
  ) {
    super(
      `ALREADY_EXISTS_DIFFERENT_PAYLOAD: idempotency key "${key}" was first seen at ${String(firstSeenAt)} with a different payload`,
    )
    this.name = 'IdempotencyMismatchError'
  }
}

export class IdempotencyInProgressError extends Error {
  constructor(public readonly key: string) {
    super(`IN_PROGRESS: idempotency key "${key}" is currently being processed by a concurrent call`)
    this.name = 'IdempotencyInProgressError'
  }
}

interface WithIdempotencyOptions<TPayload> {
  key: string
  payload: TPayload
  now?: () => number
}

export async function withIdempotency<TPayload, TResult>(
  db: Firestore,
  opts: WithIdempotencyOptions<TPayload>,
  op: () => Promise<TResult>,
): Promise<{ result: TResult; fromCache: boolean }> {
  const now = opts.now ?? (() => Date.now())
  const hash = await canonicalPayloadHash(opts.payload)
  const keyRef = db.collection('idempotency_keys').doc(opts.key)

  const cached = await db.runTransaction(async (tx) => {
    const snap = await tx.get(keyRef)
    if (!snap.exists) {
      tx.set(keyRef, {
        key: opts.key,
        payloadHash: hash,
        firstSeenAt: now(),
        processing: true,
      })
      return null
    }
    const data = snap.data() as {
      payloadHash: string
      firstSeenAt: number
      resultPayload?: TResult
      processing?: boolean
    }
    if (data.payloadHash !== hash) {
      throw new IdempotencyMismatchError(opts.key, data.firstSeenAt)
    }
    if (data.processing && !('resultPayload' in data)) {
      throw new IdempotencyInProgressError(opts.key)
    }
    return data.resultPayload ?? null
  })

  if (cached != null) {
    return { result: cached, fromCache: true }
  }

  let result: TResult
  try {
    result = await op()
  } catch (err) {
    // op() failed — clear processing so callers can retry
    await keyRef.update({ processing: false })
    throw err
  }

  // op() succeeded — persist result; leave processing=true on failure so callers back off
  await keyRef.update({ resultPayload: result, processing: false, completedAt: now() })
  return { result, fromCache: false }
}
