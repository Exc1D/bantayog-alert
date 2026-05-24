import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore, Timestamp } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireAuth, requireMfaAuth } from '../shared/https-error.js'
import { PRIVILEGED_ROLES } from '../../constants/roles.js'
import { streamAuditEvent } from '../ops/audit-stream.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { checkRateLimit } from '../shared/rate-limit.js'

// Allowlist of known Firestore collection names to prevent injection of
// arbitrary collection names that could confuse incident response.
const ALLOWED_COLLECTIONS = new Set([
  'reports',
  'report_private',
  'report_contacts',
  'report_inbox',
  'dispatches',
  'responders',
  'users',
  'active_accounts',
  'alerts',
  'agencies',
  'municipalities',
  'system_config',
  'audit_logs',
  'erasure_requests',
  'data_incidents',
])

const dataIncidentInputSchema = z.object({
  incidentType: z.enum([
    'unauthorized_access',
    'data_loss',
    'data_corruption',
    'system_breach',
    'accidental_disclosure',
  ]),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  affectedCollections: z.array(z.string().min(1)).refine(
    (collections) => {
      const unknown = collections.filter((c) => !ALLOWED_COLLECTIONS.has(c))
      if (unknown.length > 0) {
        return false
      }
      return true
    },
    { message: `Unknown collections. Allowed: ${[...ALLOWED_COLLECTIONS].join(', ')}` },
  ),
  affectedDataClasses: z.array(z.string().min(1)),
  estimatedAffectedSubjects: z.number().int().nonnegative().optional(),
  summary: z.string().min(1).max(2000),
})

export async function declareDataIncidentCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string },
): Promise<{ incidentId: string }> {
  const validated = dataIncidentInputSchema.parse(input)
  const incidentId = randomUUID()
  const eventId = randomUUID()
  const now = Date.now()

  await db.runTransaction(async (tx) => {
    await Promise.resolve()
    tx.set(db.collection('data_incidents').doc(incidentId), {
      ...validated,
      incidentId,
      status: 'declared',
      declaredAt: now,
      declaredBy: actor.uid,
      retentionExempt: false,
      schemaVersion: 1,
    })
    tx.set(db.collection('incident_response_events').doc(eventId), {
      eventId,
      incidentId,
      phase: 'declared',
      recordedBy: actor.uid,
      recordedAt: now,
      schemaVersion: 1,
    })
  })

  void streamAuditEvent({
    eventType: 'data_incident_declared',
    actorUid: actor.uid,
    targetDocumentId: incidentId,
    occurredAt: now,
  })

  return { incidentId }
}

export const declareDataIncident = onCall(
  { region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck(), maxInstances: 10 },
  async (request) => {
    const { uid } = requireAuth(request, PRIVILEGED_ROLES)
    requireMfaAuth(request)

    const rl = await checkRateLimit(getFirestore(), {
      key: `declareDataIncident:${uid}`,
      limit: 3,
      windowSeconds: 300,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit exceeded')
    }

    return declareDataIncidentCore(getFirestore(), request.data, { uid })
  },
)
