import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { adminAuth, adminDb } from '../../admin-init.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { Timestamp } from 'firebase-admin/firestore'
import { checkRateLimit } from '../shared/rate-limit.js'

export const registerCitizen = onCall(
  {
    cors: [
      'http://localhost:5173',
      'https://bantayog-citizen-staging.web.app',
      'https://bantayog-citizen-dev.web.app',
    ],
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
