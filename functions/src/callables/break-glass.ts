import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireAuth, requireMfaAuth } from './https-error.js'
import { streamAuditEvent } from '../services/audit-stream.js'

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

const breakGlassInputSchema = z.object({
  codeA: z.string().min(1).max(100),
  codeB: z.string().min(1).max(100),
  reason: z.string().min(1).max(500),
})

type BreakGlassInput = z.infer<typeof breakGlassInputSchema>

export async function initiateBreakGlassCore(
  db: Firestore,
  adminAuth: Auth,
  input: BreakGlassInput,
  actor: { uid: string },
): Promise<{ sessionId: string }> {
  const configDoc = await db.doc('system_config/break_glass_config').get()
  if (!configDoc.exists) {
    throw new HttpsError('not-found', 'break_glass_config_missing')
  }
  const { hashedCodes } = configDoc.data() as { hashedCodes: string[] }
  if (!Array.isArray(hashedCodes) || hashedCodes.length < 2) {
    throw new HttpsError('failed-precondition', 'break_glass_config_invalid')
  }

  let matchedA = -1
  for (let i = 0; i < hashedCodes.length; i++) {
    const hash = hashedCodes[i]
    if (hash && (await bcrypt.compare(input.codeA, hash))) {
      matchedA = i
      break
    }
  }
  let matchedB = -1
  for (let i = 0; i < hashedCodes.length; i++) {
    const hash = hashedCodes[i]
    if (hash && (await bcrypt.compare(input.codeB, hash))) {
      matchedB = i
      break
    }
  }
  if (matchedA === -1 || matchedB === -1 || matchedA === matchedB) {
    throw new HttpsError('unauthenticated', 'break_glass_codes_invalid')
  }

  const userRecord = await adminAuth.getUser(actor.uid)
  if (userRecord.customClaims?.breakGlassSession) {
    throw new HttpsError('failed-precondition', 'active_break_glass_session_exists')
  }

  const sessionId = randomUUID()
  const now = Date.now()
  const expiresAt = now + FOUR_HOURS_MS

  const existingClaims = userRecord.customClaims ?? {}
  await adminAuth.setCustomUserClaims(actor.uid, {
    ...existingClaims,
    breakGlassSession: true,
    breakGlassSessionId: sessionId,
    breakGlassExpiresAt: expiresAt,
  })

  await db.collection('breakglass_events').doc(sessionId).set({
    sessionId,
    actor: actor.uid,
    action: 'initiated',
    reason: input.reason,
    correlationId: sessionId,
    createdAt: now,
    sessionStartedAt: now,
    expiresAt,
    schemaVersion: 1,
  })

  void streamAuditEvent({
    eventType: 'break_glass_initiated',
    actorUid: actor.uid,
    sessionId,
    occurredAt: now,
  })

  return { sessionId }
}

export const initiateBreakGlass = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin'])
    requireMfaAuth(request)
    const data = breakGlassInputSchema.parse(request.data)
    return initiateBreakGlassCore(getFirestore(), getAuth(), data, { uid })
  },
)

export async function deactivateBreakGlassCore(
  db: Firestore,
  adminAuth: Auth,
  actor: { uid: string; claims: Record<string, unknown> },
): Promise<void> {
  const sessionId = actor.claims.breakGlassSessionId as string | undefined
  if (!sessionId) {
    throw new HttpsError('failed-precondition', 'no_active_break_glass_session')
  }

  const userRecord = await adminAuth.getUser(actor.uid)
  const currentClaims = userRecord.customClaims ?? {}
  const remainingClaims: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(currentClaims)) {
    if (
      key !== 'breakGlassSession' &&
      key !== 'breakGlassSessionId' &&
      key !== 'breakGlassExpiresAt'
    ) {
      remainingClaims[key] = value
    }
  }

  await adminAuth.setCustomUserClaims(actor.uid, remainingClaims)
  await db.collection('breakglass_events').doc(sessionId).update({
    action: 'deactivated',
    deactivatedAt: Date.now(),
  })

  void streamAuditEvent({
    eventType: 'break_glass_deactivated',
    actorUid: actor.uid,
    sessionId,
    occurredAt: Date.now(),
  })
}

export const deactivateBreakGlass = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid, claims } = requireAuth(request, ['superadmin'])
    await deactivateBreakGlassCore(getFirestore(), getAuth(), { uid, claims })
  },
)
