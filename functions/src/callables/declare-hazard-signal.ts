import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CAMARINES_NORTE_MUNICIPALITIES, hazardSignalDocSchema } from '@bantayog/shared-validators'

const declareHazardSignalInputSchema = z.object({
  signalLevel: z.number().int().min(1).max(5),
  scopeType: z.enum(['province', 'municipalities']),
  affectedMunicipalityIds: z.array(z.string().min(1)).min(1),
  validUntil: z.number().int(),
  reason: z.string().min(1).max(500),
})

const clearHazardSignalInputSchema = z.object({
  signalId: z.string().min(1),
  reason: z.string().min(1).max(500),
})

export async function declareHazardSignalCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string; role: string },
): Promise<{ signalId: string; affectedMunicipalityIds: string[] }> {
  if (actor.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'superadmin_required')
  }

  const validated = declareHazardSignalInputSchema.parse(input)

  const normalizedMunicipalityIds =
    validated.scopeType === 'province'
      ? CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id)
      : validated.affectedMunicipalityIds

  const signalId = randomUUID()
  const now = Date.now()

  const payload = {
    hazardType: 'tropical_cyclone' as const,
    signalLevel: validated.signalLevel,
    source: 'manual' as const,
    scopeType: validated.scopeType,
    affectedMunicipalityIds: normalizedMunicipalityIds,
    status: 'active' as const,
    validFrom: now,
    validUntil: validated.validUntil,
    recordedAt: now,
    rawSource: 'manual_superadmin',
    recordedBy: actor.uid,
    reason: validated.reason,
    schemaVersion: 1,
  }

  // Validate against schema before writing — catches schema drift early
  hazardSignalDocSchema.parse(payload)

  await db.collection('hazard_signals').doc(signalId).set(payload)

  return { signalId, affectedMunicipalityIds: normalizedMunicipalityIds }
}

export async function clearHazardSignalCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string; role: string },
): Promise<{ signalId: string; status: 'cleared' }> {
  if (actor.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'superadmin_required')
  }

  const validated = clearHazardSignalInputSchema.parse(input)

  await db.collection('hazard_signals').doc(validated.signalId).update({
    status: 'cleared',
    clearedAt: Date.now(),
    clearedBy: actor.uid,
  })

  return { signalId: validated.signalId, status: 'cleared' }
}

export const declareHazardSignal = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const role = request.auth.token.role as string
    return declareHazardSignalCore(getFirestore(), request.data, {
      uid: request.auth.uid,
      role,
    })
  },
)

export const clearHazardSignal = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'sign-in required')
    const role = request.auth.token.role as string
    return clearHazardSignalCore(getFirestore(), request.data, {
      uid: request.auth.uid,
      role,
    })
  },
)
