import { onCall, HttpsError } from 'firebase-functions/v2/https'
import {
  setStaffClaimsInputSchema,
  suspendStaffAccountInputSchema,
} from '@bantayog/shared-validators'
import { adminAuth, adminDb } from '../firebase-admin.js'
import {
  buildActiveAccountDoc,
  buildClaimRevocationDoc,
  buildStaffClaims,
} from './custom-claims.js'

export const setStaffClaims = onCall(async (request) => {
  if (request.auth?.token.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'Only superadmins can set staff claims.')
  }

  const parsed = setStaffClaimsInputSchema.parse(request.data)
  const claims = buildStaffClaims(parsed)
  const updatedAt = Date.now()
  const uid = parsed.uid

  await adminAuth.setCustomUserClaims(uid, claims)

  const batch = adminDb.batch()
  batch.set(
    adminDb.collection('active_accounts').doc(uid),
    buildActiveAccountDoc(uid, claims, updatedAt),
  )
  batch.set(
    adminDb.collection('claim_revocations').doc(uid),
    buildClaimRevocationDoc(uid, updatedAt, 'claims_updated'),
  )
  await batch.commit()

  return { uid, claims }
})

export const suspendStaffAccount = onCall(async (request) => {
  if (request.auth?.token.role !== 'provincial_superadmin') {
    throw new HttpsError('permission-denied', 'Only superadmins can suspend accounts.')
  }

  const input = suspendStaffAccountInputSchema.parse(request.data)
  const snapshot = await adminDb.collection('active_accounts').doc(input.uid).get()

  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Active account record not found.')
  }

  const current = snapshot.data() ?? {}
  const revokedAt = Date.now()

  await adminDb
    .collection('active_accounts')
    .doc(input.uid)
    .set({ ...current, accountStatus: 'suspended', updatedAt: revokedAt }, { merge: true })
  await adminDb
    .collection('claim_revocations')
    .doc(input.uid)
    .set(buildClaimRevocationDoc(input.uid, revokedAt, input.reason))

  return { uid: input.uid, status: 'suspended' }
})
