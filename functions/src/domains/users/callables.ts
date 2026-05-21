import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { adminAuth, adminDb } from '../../admin-init.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { Timestamp } from 'firebase-admin/firestore'
import { checkRateLimit } from '../shared/rate-limit.js'
import { getCitizenCallableCorsOrigins } from '../shared/callable-config.js'

export const registerCitizen = onCall(
  {
    cors: getCitizenCallableCorsOrigins(),
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 10,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to register.')
    }
    const rl = await checkRateLimit(adminDb, {
      key: `registerCitizen:${request.auth.uid}`,
      limit: 5,
      windowSeconds: 300,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'rate limit exceeded')
    }

    const uid = request.auth.uid

    // Prevent privileged users from stripping their own claims (audit evasion)
    const existingUser = await adminAuth.getUser(uid)
    const existingRole = existingUser.customClaims?.role as string | undefined
    if (existingRole !== undefined && existingRole !== 'citizen') {
      throw new HttpsError(
        'failed-precondition',
        `User already has role '${existingRole}' assigned. Contact an administrator to change roles.`,
      )
    }

    const now = Date.now()

    const claims = {
      role: 'citizen' as const,
      accountStatus: 'active' as const,
      mfaEnrolled: false,
      lastClaimIssuedAt: now,
    }

    await adminAuth.setCustomUserClaims(uid, claims)

    const batch = adminDb.batch()
    batch.set(adminDb.collection('active_accounts').doc(uid), {
      uid,
      role: claims.role,
      accountStatus: claims.accountStatus,
      municipalityId: null,
      agencyId: null,
      permittedMunicipalityIds: [],
      mfaEnrolled: claims.mfaEnrolled,
      lastClaimIssuedAt: claims.lastClaimIssuedAt,
      updatedAt: now,
    })
    batch.set(adminDb.collection('claim_revocations').doc(uid), {
      uid,
      revokedAt: now,
      reason: 'claims_updated',
    })
    await batch.commit()

    return { uid, role: 'citizen', accountStatus: 'active' }
  },
)
