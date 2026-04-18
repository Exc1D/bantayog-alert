import type { Firestore, Timestamp } from 'firebase-admin/firestore'

export interface RateLimitCheck {
  key: string
  limit: number
  windowSeconds: number
  now: Timestamp
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export async function checkRateLimit(
  db: Firestore,
  { key, limit, windowSeconds, now }: RateLimitCheck,
): Promise<RateLimitResult> {
  const ref = db.collection('rate_limits').doc(key)
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const windowStartMs = now.toMillis() - windowSeconds * 1000
    const bucket = snap.exists ? snap.data() : undefined
    const existingTimes: number[] = Array.isArray(bucket?.timestamps) ? bucket.timestamps : []
    const fresh = existingTimes.filter((ms) => ms >= windowStartMs)

    if (fresh.length >= limit) {
      const earliest = Math.min(...fresh)
      const retryAfterSeconds = Math.ceil((earliest + windowSeconds * 1000 - now.toMillis()) / 1000)
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(retryAfterSeconds, 1) }
    }

    fresh.push(now.toMillis())
    tx.set(ref, { timestamps: fresh }, { merge: true })
    return { allowed: true, remaining: limit - fresh.length, retryAfterSeconds: 0 }
  })
}
