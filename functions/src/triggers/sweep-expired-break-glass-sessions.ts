import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { streamAuditEvent } from '../services/audit-stream.js'

export const sweepExpiredBreakGlassSessions = onSchedule(
  { schedule: 'every 5 minutes', region: 'asia-southeast1', timeZone: 'UTC' },
  async () => {
    const db = getFirestore()
    const adminAuth = getAuth()
    const now = Date.now()

    const snap = await db
      .collection('breakglass_events')
      .where('action', '==', 'initiated')
      .where('expiresAt', '<', now)
      .get()

    for (const doc of snap.docs) {
      const { actorUid, sessionId } = doc.data() as { actorUid: string; sessionId: string }
      try {
        const userRecord = await adminAuth.getUser(actorUid)
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
        await adminAuth.setCustomUserClaims(actorUid, remaining)
        await doc.ref.update({ action: 'auto_expired', expiredAt: now })
        void streamAuditEvent({
          eventType: 'break_glass_auto_expired',
          actorUid,
          sessionId,
          occurredAt: now,
        })
      } catch (err: unknown) {
        console.error('[sweep-break-glass] failed for session', sessionId, err)
      }
    }
  },
)
