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

interface WithIdempotencyOptions<TPayload> {
  key: string
  payload: TPayload
  now?: () => number
}

export async function withIdempotency<TPayload, TResult>(
  db: Firestore,
  opts: WithIdempotencyOptions<TPayload>,
  op: () => Promise<TResult>,
): Promise<TResult> {
  const now = opts.now ?? (() => Date.now())
  const hash = canonicalPayloadHash(opts.payload)
  const keyRef = db.collection('idempotency_keys').doc(opts.key)

  const cached = await db.runTransaction(async (tx) => {
    const snap = await tx.get(keyRef)
    if (!snap.exists) {
      tx.set(keyRef, {
        key: opts.key,
        payloadHash: hash,
        firstSeenAt: now(),
      })
      return null
    }
    const data = snap.data() as {
      payloadHash: string
      firstSeenAt: number
      resultPayload?: TResult
    }
    if (data.payloadHash !== hash) {
      throw new IdempotencyMismatchError(opts.key, data.firstSeenAt)
    }
    return (data.resultPayload ?? null) as TResult | null
  })

  if (cached != null) {
    return cached
  }

  const result = await op()
  await keyRef.update({ resultPayload: result, completedAt: now() })
  return result
}
