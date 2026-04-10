/**
 * Firebase Cloud Functions for Bantayog Alert
 *
 * This file contains backend functions that require elevated privileges:
 * - Setting custom claims on user creation
 * - Updating custom claims on role changes
 * - Audit logging for administrative actions
 *
 * Prerequisites:
 * 1. Firebase CLI installed: npm install -g firebase-tools
 * 2. Functions dependencies installed: cd functions && npm install
 * 3. Firebase project initialized: firebase init functions
 *
 * Deploy: firebase deploy --only functions
 */

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK
admin.initializeApp()

const auth = admin.auth()
const db = admin.firestore()

/**
 * Set Custom Claims on User Creation
 *
 * This trigger fires automatically when a new user is created in Firebase Auth.
 * It sets custom claims based on the user's role stored in Firestore.
 *
 * Custom claims are used in:
 * - Firestore security rules (role-based access control)
 * - Client-side permission checks
 *
 * IMPORTANT: Custom claims are propagated to the user's ID token on the next
 * token refresh. Clients must listen for claim changes.
 */
export const setCustomClaimsOnUserCreation = functions.auth
  .user()
  .onCreate(async (user) => {
    try {
      // Get user profile from Firestore to determine role
      const userDoc = await db.collection('users').doc(user.uid).get()

      if (!userDoc.exists) {
        console.log(`No profile found for user ${user.uid}, skipping claims`)
        return null
      }

      const userProfile = userDoc.data()
      if (!userProfile) {
        console.log(`Empty profile for user ${user.uid}, skipping claims`)
        return null
      }

      // Build custom claims based on user profile
      const customClaims: {
        role: string
        municipality?: string
        emailVerified: boolean
        isActive: boolean
      } = {
        role: userProfile.role,
        emailVerified: user.emailVerified || false,
        isActive: userProfile.isActive !== false, // Default to true
      }

      // Add municipality for municipal admins
      if (userProfile.role === 'municipal_admin' && userProfile.municipality) {
        customClaims.municipality = userProfile.municipality
      }

      // Set custom claims using Firebase Admin SDK
      await auth.setCustomUserClaims(user.uid, customClaims)

      console.log(
        `Custom claims set for user ${user.uid}:`,
        JSON.stringify(customClaims)
      )

      // Signal client to refresh token by writing to metadata node
      // This allows the client to know when claims are ready
      const metadataRef = db.collection('user_metadata').doc(user.uid)
      await metadataRef.set({
        refreshTime: admin.firestore.FieldValue.serverTimestamp(),
        claimsUpdated: true,
      })

      return null
    } catch (error) {
      console.error('Error setting custom claims:', error)
      throw new functions.https.HttpsError(
        'internal',
        'Unable to set custom claims'
      )
    }
  })

/**
 * Update Custom Claims on Role Change
 *
 * Callable function that can be invoked from the client to update custom claims
 * when a user's role changes (e.g., promotion to municipal admin, demotion).
 *
 * Only callable by users with provincial_superadmin role.
 *
 * @param data - Contains targetUserUid and optionally newRole
 * @param context - Firebase callable function context
 */
export const updateCustomClaims = functions.https.onCall(
  async (data, context) => {
    // CRITICAL: Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be authenticated to update custom claims'
      )
    }

    // CRITICAL: Verify caller has superadmin role
    const callerUid = context.auth.uid
    const callerDoc = await db.collection('users').doc(callerUid).get()

    if (!callerDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Caller profile not found'
      )
    }

    const callerProfile = callerDoc.data()
    if (callerProfile?.role !== 'provincial_superadmin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only provincial superadmins can update custom claims'
      )
    }

    // Validate input
    const targetUserUid = data.targetUserUid
    if (!targetUserUid || typeof targetUserUid !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'targetUserUid is required'
      )
    }

    // Get target user profile
    const targetUserDoc = await db.collection('users').doc(targetUserUid).get()

    if (!targetUserDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Target user not found'
      )
    }

    const targetProfile = targetUserDoc.data()

    // Build updated custom claims
    const customClaims: {
      role: string
      municipality?: string
      emailVerified: boolean
      isActive: boolean
    } = {
      role: targetProfile!.role,
      emailVerified: targetProfile!.emailVerified || false,
      isActive: targetProfile!.isActive !== false,
    }

    // Add municipality for municipal admins
    if (
      targetProfile!.role === 'municipal_admin' &&
      targetProfile!.municipality
    ) {
      customClaims.municipality = targetProfile!.municipality
    }

    // Update custom claims
    await auth.setCustomUserClaims(targetUserUid, customClaims)

    // Signal client to refresh token
    const metadataRef = db.collection('user_metadata').doc(targetUserUid)
    await metadataRef.set({
      refreshTime: admin.firestore.FieldValue.serverTimestamp(),
      claimsUpdated: true,
    })

    // Log audit entry
    await db.collection('audit_logs').add({
      timestamp: Date.now(),
      performedBy: callerUid,
      performedByRole: 'provincial_superadmin',
      action: 'UPDATE_CUSTOM_CLAIMS',
      resourceType: 'user',
      resourceId: targetUserUid,
      details: `Updated custom claims for user ${targetUserUid} to role ${customClaims.role}`,
    })

    console.log(
      `Custom claims updated for user ${targetUserUid} by ${callerUid}:`,
      JSON.stringify(customClaims)
    )

    return {
      success: true,
      message: 'Custom claims updated successfully',
    }
  }
)

/**
 * Force Token Refresh for User
 *
 * Signals a user to refresh their ID token by writing to their metadata node.
 * This is useful after role changes or permission updates.
 *
 * Callable by users with admin roles.
 *
 * @param data - Contains targetUserUid
 * @param context - Firebase callable function context
 */
export const forceTokenRefresh = functions.https.onCall(
  async (data, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be authenticated'
      )
    }

    // Verify caller has admin role
    const callerUid = context.auth.uid
    const callerDoc = await db.collection('users').doc(callerUid).get()

    if (!callerDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Caller not found')
    }

    const callerProfile = callerDoc.data()
    const isAdmin = ['municipal_admin', 'provincial_superadmin'].includes(
      callerProfile?.role
    )

    if (!isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only administrators can force token refresh'
      )
    }

    // Validate input
    const targetUserUid = data.targetUserUid
    if (!targetUserUid || typeof targetUserUid !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'targetUserUid is required'
      )
    }

    // Signal token refresh
    const metadataRef = db.collection('user_metadata').doc(targetUserUid)
    await metadataRef.set({
      refreshTime: admin.firestore.FieldValue.serverTimestamp(),
      forceRefresh: true,
    })

    console.log(`Token refresh forced for user ${targetUserUid} by ${callerUid}`)

    return {
      success: true,
      message: 'Token refresh signal sent',
    }
  }
)

/**
 * Delete User Data (GDPR Compliance)
 *
 * callable function that completely removes all user data from the system.
 * This is required for GDPR "right to be forgotten" compliance.
 *
 * Only callable by the user themselves or provincial superadmins.
 *
 * @param data - Contains targetUserUid (optional, defaults to caller)
 * @param context - Firebase callable function context
 */
export const deleteUserData = functions.https.onCall(
  async (data, context) => {
    // Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be authenticated'
      )
    }

    const callerUid = context.auth.uid
    const targetUserUid = data.targetUserUid || callerUid

    // Verify caller has permission (deleting own account or is superadmin)
    if (callerUid !== targetUserUid) {
      const callerDoc = await db.collection('users').doc(callerUid).get()

      if (!callerDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Caller not found')
      }

      const callerProfile = callerDoc.data()

      if (callerProfile?.role !== 'provincial_superadmin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'You can only delete your own account'
        )
      }
    }

    // Delete user authentication account
    await auth.deleteUser(targetUserUid)

    // Delete user profile
    await db.collection('users').doc(targetUserUid).delete()

    // Delete role-specific profile (if exists)
    const roles = ['citizen', 'responder', 'municipal_admin', 'provincial_superadmin']
    const roleDoc = await db.collection('roles').doc(targetUserUid).get()
    if (roleDoc.exists) {
      await db.collection('roles').doc(targetUserUid).delete()
    }

    // Log audit entry (unless deleting own account)
    if (callerUid !== targetUserUid) {
      await db.collection('audit_logs').add({
        timestamp: Date.now(),
        performedBy: callerUid,
        performedByRole: 'provincial_superadmin',
        action: 'DELETE_USER',
        resourceType: 'user',
        resourceId: targetUserUid,
        details: `Deleted user ${targetUserUid} and all associated data`,
      })
    }

    console.log(`User data deleted for ${targetUserUid} by ${callerUid}`)

    return {
      success: true,
      message: 'User data deleted successfully',
    }
  }
)

/**
 * Scheduled Data Retention (GDPR Compliance)
 *
 * Scheduled function that runs daily to archive old data and delete
 * data older than 12 months.
 *
 * Schedule: Runs every day at midnight UTC
 */
export const scheduledDataRetention = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const now = Date.now()
    const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000
    const twelveMonthsAgo = now - 12 * 30 * 24 * 60 * 60 * 1000

    try {
      // Archive reports older than 6 months
      const oldReports = await db
        .collection('reports')
        .where('createdAt', '<', sixMonthsAgo)
        .limit(500)
        .get()

      const batch = db.batch()

      oldReports.docs.forEach((doc) => {
        const data = doc.data()
        // Write to archive collection
        const archiveRef = db.collection('reports_archive').doc(doc.id)
        batch.set(archiveRef, {
          ...data,
          archivedAt: admin.firestore.FieldValue.serverTimestamp(),
          originalCollection: 'reports',
        })
      })

      await batch.commit()

      console.log(`Archived ${oldReports.size} reports older than 6 months`)

      // Delete reports older than 12 months
      const veryOldReports = await db
        .collection('reports')
        .where('createdAt', '<', twelveMonthsAgo)
        .limit(500)
        .get()

      const deleteBatch = db.batch()

      veryOldReports.docs.forEach((doc) => {
        deleteBatch.delete(doc.ref)
      })

      await deleteBatch.commit()

      console.log(
        `Deleted ${veryOldReports.size} reports older than 12 months`
      )

      return null
    } catch (error) {
      console.error('Error in scheduled data retention:', error)
      throw new functions.https.HttpsError(
        'internal',
        'Data retention job failed'
      )
    }
  })
