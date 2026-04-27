import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireAuth, requireMfaAuth } from './https-error.js'
import { streamAuditEvent } from '../services/audit-stream.js'

const PHASE_ORDER = [
  'declared',
  'contained',
  'preserved',
  'assessed',
  'notified_npc',
  'notified_subjects',
  'post_report',
  'closed',
] as const

const recordEventInputSchema = z.object({
  incidentId: z.string().min(1),
  phase: z.enum(PHASE_ORDER),
  notes: z.string().max(4000).optional(),
})

export async function recordIncidentResponseEventCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string },
): Promise<{ eventId: string }> {
  const validated = recordEventInputSchema.parse(input)
  const eventId = randomUUID()
  const now = Date.now()

  await db.runTransaction(async (tx) => {
    const incidentRef = db.collection('data_incidents').doc(validated.incidentId)
    const incidentSnap = await tx.get(incidentRef)

    if (!incidentSnap.exists) {
      throw new HttpsError('not-found', 'incident_not_found')
    }

    const incidentData = incidentSnap.data() as { status: string }
    const currentIndex = PHASE_ORDER.indexOf(incidentData.status as (typeof PHASE_ORDER)[number])
    const nextIndex = PHASE_ORDER.indexOf(validated.phase)

    if (nextIndex !== currentIndex + 1) {
      throw new HttpsError('failed-precondition', 'invalid_phase_transition')
    }

    tx.update(incidentRef, { status: validated.phase })
    tx.set(db.collection('incident_response_events').doc(eventId), {
      eventId,
      incidentId: validated.incidentId,
      phase: validated.phase,
      notes: validated.notes,
      recordedBy: actor.uid,
      recordedAt: now,
      schemaVersion: 1,
    })
  })

  void streamAuditEvent({
    eventType: 'incident_response_event_recorded',
    actorUid: actor.uid,
    sessionId: validated.incidentId,
    metadata: { phase: validated.phase },
    occurredAt: now,
  })

  return { eventId }
}

export const recordIncidentResponseEvent = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin'])
    requireMfaAuth(request)
    return recordIncidentResponseEventCore(getFirestore(), request.data, {
      uid,
    })
  },
)
