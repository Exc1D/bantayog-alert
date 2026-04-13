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
 *   severity: 'emergency' | 'warning' | 'info',
 *   type: 'evacuation' | 'weather' | 'health' | 'infrastructure' | 'other',
 *   affectedAreas?: { municipalities: string[], barangays?: string[] },
 *   source?: string,
 *   sourceUrl?: string,
 *   targetMunicipality?: string,   // required for municipal_admin
 *   expiresAt?: number,           // Unix timestamp
 * }
 */

const VALID_SEVERITIES = ['info', 'warning', 'emergency'] as const
const VALID_TYPES = ['evacuation', 'weather', 'health', 'infrastructure', 'other'] as const

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

  // 5. Validate severity enum — prevent arbitrary string injection
  if (!VALID_SEVERITIES.includes(data.severity)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid severity value'
    )
  }

  // 6. Validate type enum if provided
  if (data.type && !VALID_TYPES.includes(data.type)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Invalid type value'
    )
  }

  // 7. Write alert + audit log; use allSettled so audit failure does not
  //    silently swallow the success response sent to the client.
  const now = Date.now()
  const alertData = {
    title: data.title,
    message: data.message,
    severity: data.severity,
    type: data.type,
    affectedAreas: data.affectedAreas,
    source: data.source,
    sourceUrl: data.sourceUrl,
    targetAudience: data.targetAudience,
    targetMunicipality: data.targetMunicipality,
    targetRole: data.targetRole,
    deliveryMethod: data.deliveryMethod,
    linkUrl: data.linkUrl,
    metadata: data.metadata,
    expiresAt: data.expiresAt,
    createdBy: context.auth.uid,
    createdAt: now,
    isActive: true,
  }

  let alertId = 'unknown'

  try {
    const [alertResult, auditResult] = await Promise.allSettled([
      admin.firestore().collection('alerts').add(alertData),
      admin.firestore().collection('audit_logs').add({
        timestamp: now,
        performedBy: context.auth.uid,
        performedByRole: role,
        action: 'CREATE_ALERT',
        resourceType: 'alert',
        resourceId: 'pending', // filled in after we know the alert ID
        details: `Created alert: ${data.title}`,
      }),
    ])

    // Extract alert ID — guard against unexpected rejection
    if (alertResult.status === 'fulfilled') {
      alertId = alertResult.value?.id ?? 'unknown'
    } else {
      console.error('createAlert: alert write failed:', alertResult.reason)
      throw new functions.https.HttpsError('internal', 'Failed to create alert')
    }

    // Audit failure is logged but does not fail the request — the alert was created
    if (auditResult.status === 'rejected') {
      console.error(
        'createAlert: audit log write failed for alert',
        alertId,
        auditResult.reason
      )
    }
  } catch (err: unknown) {
    console.error('createAlert: firestore error:', err)
    throw new functions.https.HttpsError('internal', 'Failed to create alert')
  }

  return { id: alertId }
})
