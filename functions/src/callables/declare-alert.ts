import { onCall } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireAuth, requireMfaAuth } from './https-error.js'
import { PRIVILEGED_ROLES } from '../constants/roles.js'
import { streamAuditEvent } from '../services/audit-stream.js'

const declareAlertInputSchema = z.object({
  hazardType: z.string().min(1).max(100),
  affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
  message: z.string().min(1).max(500),
  reportId: z.uuid().optional(),
})

export async function declareAlertCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string },
): Promise<{ alertId: string }> {
  const validated = declareAlertInputSchema.parse(input)
  const alertId = randomUUID()
  const now = Date.now()

  const alertDoc: Record<string, unknown> = {
    alertId,
    alertType: 'alert',
    hazardType: validated.hazardType,
    affectedMunicipalityIds: validated.affectedMunicipalityIds,
    message: validated.message,
    declaredBy: actor.uid,
    declaredAt: now,
    schemaVersion: 1,
  }

  if (validated.reportId) {
    alertDoc.reportId = validated.reportId
  }

  await db.collection('alerts').doc(alertId).set(alertDoc)

  void streamAuditEvent({
    eventType: 'alert_declared',
    actorUid: actor.uid,
    targetDocumentId: alertId,
    metadata: { hazardType: validated.hazardType },
    occurredAt: now,
  })

  return { alertId }
}

export const declareAlert = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, PRIVILEGED_ROLES)
    requireMfaAuth(request)
    return declareAlertCore(getFirestore(), request.data, { uid })
  },
)
