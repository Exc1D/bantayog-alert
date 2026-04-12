import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

/**
 * Create Alert — Admin Cloud Function
 *
 * Allows municipal_admin or provincial_superadmin to create official government
 * alerts. Municipal admins are restricted to their own municipality.
 *
 * Data shape expected:
 * {
 *   title: string,
 *   message: string,
 *   severity: 'emergency' | 'warning' | 'advisory',
 *   type: 'evacuation' | 'weather' | 'health' | 'infrastructure' | 'other',
 *   affectedAreas?: { municipalities: string[], barangays?: string[] },
 *   source?: string,
 *   sourceUrl?: string,
 *   targetMunicipality?: string,   // required for municipal_admin
 *   expiresAt?: number,           // Unix timestamp
 * }
 */
export const createAlert = functions.https.onCall(async (data, context) => {
  // 1. Verify authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in')
  }

  // 2. Verify admin role
  const role = context.auth.token.role as string
  if (role !== 'municipal_admin' && role !== 'provincial_superadmin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Admin access required'
    )
  }

  // 3. Municipal admins can only create for their municipality
  if (
    role === 'municipal_admin' &&
    data.targetMunicipality !== context.auth.token.municipality
  ) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Cannot create alert for other municipality'
    )
  }

  // 4. Validate required fields
  if (!data.title || !data.message || !data.severity) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Missing required fields'
    )
  }

  // 5. Create alert document
  const alertData = {
    ...data,
    createdBy: context.auth.uid,
    createdAt: Date.now(),
    isActive: true,
  }

  const docRef = await admin.firestore().collection('alerts').add(alertData)

  // 6. Create audit log
  await admin.firestore().collection('audit_logs').add({
    timestamp: Date.now(),
    performedBy: context.auth.uid,
    performedByRole: role,
    action: 'CREATE_ALERT',
    resourceType: 'alert',
    resourceId: docRef.id,
    details: `Created alert: ${data.title}`,
  })

  return { id: docRef.id }
})
