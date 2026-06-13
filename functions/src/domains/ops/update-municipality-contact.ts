import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { updateMunicipalityContactInputSchema } from '@bantayog/shared-validators'
import { adminDb } from '../../admin-init.js'
import { PROVINCIAL_SUPERADMIN } from '../../constants/roles.js'
import { requireAuth } from '../shared/https-error.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { getAdminCallableCorsOrigins } from '../shared/callable-config.js'
import { checkRateLimit } from '../shared/rate-limit.js'
import { streamAuditEvent } from './audit-stream.js'

export interface UpdateMunicipalityContactDeps {
  municipalityId: string
  mdrrmoLabel: string
  mdrrmoHotline: string
  actor: {
    uid: string
    claims: {
      role?: string
      municipalityId?: string
    }
  }
  now: number
}

/**
 * Provincial superadmins edit any municipality's MDRRMO contact card; a
 * municipal admin may only edit their own jurisdiction. Citizens see these
 * fields live on the post-submission RevealSheet and SMS/hotline fallbacks.
 */
function assertActorCanEditContact(deps: UpdateMunicipalityContactDeps): void {
  const { role, municipalityId } = deps.actor.claims
  if (role === PROVINCIAL_SUPERADMIN) return
  if (role !== 'municipal_admin') {
    throw new HttpsError('permission-denied', 'municipal_admin or provincial_superadmin required')
  }
  if (!municipalityId) {
    throw new HttpsError('permission-denied', 'municipality scope required')
  }
  if (municipalityId !== deps.municipalityId) {
    throw new HttpsError('permission-denied', 'municipality not in your jurisdiction')
  }
}

export async function updateMunicipalityContactCore(
  db: Firestore,
  deps: UpdateMunicipalityContactDeps,
): Promise<{
  municipalityId: string
  mdrrmoLabel: string
  mdrrmoHotline: string
  updatedAt: number
}> {
  assertActorCanEditContact(deps)

  const ref = db.collection('municipalities').doc(deps.municipalityId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw new HttpsError('not-found', 'municipality not found')
  }

  await ref.update({
    mdrrmoLabel: deps.mdrrmoLabel,
    mdrrmoHotline: deps.mdrrmoHotline,
    contactUpdatedAt: deps.now,
    contactUpdatedBy: deps.actor.uid,
  })

  void streamAuditEvent({
    eventType: 'municipality_contact_updated',
    actorUid: deps.actor.uid,
    targetCollection: 'municipalities',
    targetDocumentId: deps.municipalityId,
    metadata: {
      mdrrmoLabel: deps.mdrrmoLabel,
      mdrrmoHotline: deps.mdrrmoHotline,
      actorRole: deps.actor.claims.role ?? 'municipal_admin',
    },
    occurredAt: deps.now,
  })

  return {
    municipalityId: deps.municipalityId,
    mdrrmoLabel: deps.mdrrmoLabel,
    mdrrmoHotline: deps.mdrrmoHotline,
    updatedAt: deps.now,
  }
}

export const updateMunicipalityContact = onCall(
  {
    region: 'asia-southeast1',
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
    cors: getAdminCallableCorsOrigins(),
  },
  async (request: CallableRequest<unknown>) => {
    const { uid, claims } = requireAuth(request, [PROVINCIAL_SUPERADMIN, 'municipal_admin'])

    const parsed = updateMunicipalityContactInputSchema.safeParse(request.data)
    if (!parsed.success) {
      console.error('updateMunicipalityContact validation failed:', z.treeifyError(parsed.error))
      throw new HttpsError('invalid-argument', 'malformed payload')
    }

    const rl = await checkRateLimit(getFirestore(), {
      key: `updateMunicipalityContact:${uid}`,
      limit: 10,
      windowSeconds: 60,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit', {
        retryAfterSeconds: rl.retryAfterSeconds,
      })
    }

    const actorClaims: UpdateMunicipalityContactDeps['actor']['claims'] = {}
    if (typeof claims.role === 'string') actorClaims.role = claims.role
    if (typeof claims.municipalityId === 'string')
      actorClaims.municipalityId = claims.municipalityId

    return updateMunicipalityContactCore(adminDb, {
      municipalityId: parsed.data.municipalityId,
      mdrrmoLabel: parsed.data.mdrrmoLabel,
      mdrrmoHotline: parsed.data.mdrrmoHotline,
      actor: { uid, claims: actorClaims },
      now: Date.now(),
    })
  },
)
