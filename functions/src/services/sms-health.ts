import type { Firestore } from 'firebase-admin/firestore'
import { FieldValue } from 'firebase-admin/firestore'

export type CircuitState = 'closed' | 'open' | 'half_open'

export class NoProviderAvailableError extends Error {
  constructor() {
    super('No SMS provider available (both circuits open)')
    this.name = 'NoProviderAvailableError'
  }
}

export async function readCircuitState(
  db: Firestore,
  providerId: 'semaphore' | 'globelabs',
): Promise<CircuitState> {
  const snap = await db.collection('sms_provider_health').doc(providerId).get()
  if (!snap.exists) return 'closed'
  const data = snap.data() as { circuitState?: CircuitState } | undefined
  return data?.circuitState ?? 'closed'
}

export async function pickProvider(db: Firestore): Promise<'semaphore' | 'globelabs'> {
  const [semaphore, globelabs] = await Promise.all([
    readCircuitState(db, 'semaphore'),
    readCircuitState(db, 'globelabs'),
  ])
  const usable = (s: CircuitState): boolean => s === 'closed' || s === 'half_open'
  if (usable(semaphore)) return 'semaphore'
  if (usable(globelabs)) return 'globelabs'
  throw new NoProviderAvailableError()
}

function minuteWindowId(tsMs: number): string {
  const d = new Date(tsMs)
  const y = d.getUTCFullYear().toString()
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const da = d.getUTCDate().toString().padStart(2, '0')
  const h = d.getUTCHours().toString().padStart(2, '0')
  const mi = d.getUTCMinutes().toString().padStart(2, '0')
  return `${y}${mo}${da}${h}${mi}`
}

export interface IncrementOutcome {
  success: boolean
  rateLimited: boolean
  latencyMs: number
}

export async function incrementMinuteWindow(
  db: Firestore,
  providerId: 'semaphore' | 'globelabs',
  outcome: IncrementOutcome,
  nowMs: number,
): Promise<void> {
  const windowId = minuteWindowId(nowMs)
  const windowStartMs = nowMs - (nowMs % 60_000)
  const ref = db
    .collection('sms_provider_health')
    .doc(providerId)
    .collection('minute_windows')
    .doc(windowId)

  await ref.set(
    {
      providerId,
      windowStartMs,
      attempts: FieldValue.increment(1),
      failures: FieldValue.increment(outcome.success ? 0 : 1),
      rateLimitedCount: FieldValue.increment(outcome.rateLimited ? 1 : 0),
      latencySumMs: FieldValue.increment(outcome.latencyMs),
      maxLatencyMs: outcome.latencyMs,
      updatedAt: nowMs,
      schemaVersion: 1,
    },
    { merge: true },
  )
}
