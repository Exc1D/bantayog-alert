import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireAuth, requireMfaAuth } from './https-error.js'
import { PDRRMO, PROVINCIAL_SUPERADMIN } from '../constants/roles.js'
import { streamAuditEvent } from '../services/audit-stream.js'
import { shouldEnforceAppCheck } from './app-check-config.js'

const declareAlertInputSchema = z.object({
  hazardType: z.string().min(1).max(100),
  affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
  message: z.string().min(1).max(500),
  reportId: z.uuid().optional(),
})

export async function declareAlertCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string; claims?: Record<string, unknown> },
): Promise<{ alertId: string }> {
  const validated = declareAlertInputSchema.parse(input)
  if (actor.claims?.role === 'municipal_admin') {
    const municipalityId = actor.claims.municipalityId
    if (
      typeof municipalityId !== 'string' ||
      validated.affectedMunicipalityIds.some((id) => id !== municipalityId)
    ) {
      throw new HttpsError(
        'permission-denied',
        'municipal_admin can only declare alerts for their municipality',
      )
    }
  }
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
    publishedAt: now,
    schemaVersion: 1,
  }

  if (validated.reportId) {
    alertDoc.reportId = validated.reportId
  }

  await db.collection('alerts').doc(alertId).set(alertDoc)

  if (process.env.FUNCTIONS_EMULATOR !== 'true') {
    // Best-effort FCM push — don't fail alert creation if push fails
    try {
      const { messaging } = await import('firebase-admin')
      await messaging().send({
        topic: 'alerts',
        notification: {
          title: 'Alert Issued',
          body: validated.message,
        },
        data: {
          alertId,
          hazardType: validated.hazardType,
        },
      })
    } catch (err: unknown) {
      console.error('FCM push failed:', err)
    }
  }

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
  { region: 'asia-southeast1', enforceAppCheck: shouldEnforceAppCheck() },
  async (request) => {
    const { uid, claims } = requireAuth(request, [
      PROVINCIAL_SUPERADMIN,
      PDRRMO,
      'municipal_admin',
    ])
    requireMfaAuth(request)
    return declareAlertCore(getFirestore(), request.data, { uid, claims })
  },
)
