import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { streamAuditEvent } from '../services/audit-stream.js'

export interface SweepExpiredBreakGlassSessionsInput {
  db: Firestore
  auth: Auth
  now?: () => number
}

export interface SweepExpiredBreakGlassSessionsResult {
  expired: number
  failed: number
}

export async function sweepExpiredBreakGlassSessionsCore(
  input: SweepExpiredBreakGlassSessionsInput,
): Promise<SweepExpiredBreakGlassSessionsResult> {
  const now = input.now ? input.now() : Date.now()
  const result: SweepExpiredBreakGlassSessionsResult = { expired: 0, failed: 0 }

  const snap = await input.db
    .collection('breakglass_events')
    .where('action', '==', 'initiated')
    .where('expiresAt', '<', now)
    .get()

  for (const doc of snap.docs) {
    const { actorUid, sessionId } = doc.data() as { actorUid: string; sessionId: string }
    try {
      const userRecord = await input.auth.getUser(actorUid)
      const currentClaims = userRecord.customClaims ?? {}
      const remaining: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(currentClaims)) {
        if (
          key !== 'breakGlassSession' &&
          key !== 'breakGlassSessionId' &&
          key !== 'breakGlassExpiresAt'
        ) {
          remaining[key] = value
        }
      }
      await input.auth.setCustomUserClaims(actorUid, remaining)
      await doc.ref.update({ action: 'auto_expired', expiredAt: now })
      void streamAuditEvent({
        eventType: 'break_glass_auto_expired',
        actorUid,
        sessionId,
        occurredAt: now,
      })
      result.expired++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      console.error('[sweep-break-glass] failed for session', sessionId, {
        message,
        stack,
      })
      result.failed++
      throw err
    }
  }

  return result
}

export const sweepExpiredBreakGlassSessions = onSchedule(
  { schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' },
  async () => {
    await sweepExpiredBreakGlassSessionsCore({
      db: getFirestore(),
      auth: getAuth(),
    })
  },
)
