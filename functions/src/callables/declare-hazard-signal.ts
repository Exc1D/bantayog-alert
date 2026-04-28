import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CAMARINES_NORTE_MUNICIPALITIES, hazardSignalDocSchema } from '@bantayog/shared-validators'
import { replayHazardSignalProjection } from '../services/hazard-signal-projector.js'

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

/**
 * Declares a new hazard signal (tropical cyclone warning) for a province or set of municipalities.
 * Validates the actor's superadmin role, normalizes province scope to all Camarines Norte
 * municipalities, writes the signal document, and triggers a projection replay.
 *
 * @param db - Firestore instance
 * @param input - Signal parameters (signalLevel, scopeType, affectedMunicipalityIds, validUntil, reason)
 * @param actor - Authenticated user with uid and role
 * @returns The created signalId and the normalized list of affected municipality IDs
 * @throws HttpsError('permission-denied') if actor is not provincial_superadmin
 */
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

  if (validated.scopeType === 'municipalities') {
    const KNOWN = new Set(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id))
    const unknown = normalizedMunicipalityIds.filter((id) => !KNOWN.has(id))
    if (unknown.length > 0) {
      throw new HttpsError('invalid-argument', `unknown_municipality_ids: ${unknown.join(', ')}`)
    }
  }

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

  await replayHazardSignalProjection({ db, now })

  return { signalId, affectedMunicipalityIds: normalizedMunicipalityIds }
}

/**
 * Clears an active hazard signal by marking it as cleared with the actor's uid and timestamp.
 * Verifies the signal exists and is currently active before clearing, then triggers a
 * projection replay to update the live status.
 *
 * @param db - Firestore instance
 * @param input - Clear parameters (signalId, reason)
 * @param actor - Authenticated user with uid and role
 * @returns The cleared signalId and status
 * @throws HttpsError('permission-denied') if actor is not provincial_superadmin
 * @throws HttpsError('not-found') if the signal document does not exist
 * @throws HttpsError('failed-precondition') if the signal is not currently active
 */
export async function clearHazardSignalCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string; role: string },
): Promise<{ signalId: string; status: 'cleared' }> {
  if (actor.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'superadmin_required')
  }

  const validated = clearHazardSignalInputSchema.parse(input)

  const ref = db.collection('hazard_signals').doc(validated.signalId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', 'signal_not_found')
  }

  const data = snap.data() as { status: string }
  if (data.status !== 'active') {
    throw new HttpsError('failed-precondition', 'signal_not_active')
  }

  await ref.update({
    status: 'cleared',
    clearedAt: Date.now(),
    clearedBy: actor.uid,
  })

  await replayHazardSignalProjection({ db, now: Date.now() })

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
