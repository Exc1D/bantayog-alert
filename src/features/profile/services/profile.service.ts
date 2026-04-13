/**
 * Citizen Profile Service
 *
 * Handles profile-related operations for citizens.
 * Includes fetching user's reports, data export, and account deletion.
 */

import { getDocs, collection, query, where, orderBy } from 'firebase/firestore'
import { db } from '@/app/firebase/config'
import { getDocument } from '@/shared/services/firestore.service'
import { callFunction } from '@/shared/services/functions.service'
import type { ReportPrivate, Report } from '@/shared/types/firestore.types'

/**
 * User's submitted report summary
 */
export interface UserReportSummary {
  id: string
  reportId: string
  incidentType: Report['incidentType']
  status: Report['status']
  createdAt: number
  approximateLocation: {
    barangay: string
    municipality: string
  }
}

/**
 * Full user data export for GDPR
 */
export interface UserDataExport {
  exportedAt: number
  user: {
    uid: string
    email: string
    role: string
    createdAt: number
  }
  reports: UserReportSummary[]
}

/**
 * Fetch all reports submitted by a user
 *
 * Queries report_private collection for reports where reporterUserId matches.
 * Returns summary data without sensitive private details.
 *
 * @param userId - The user's UID
 * @returns Array of user's report summaries
 */
export async function getUserReports(userId: string): Promise<UserReportSummary[]> {
  try {
    // Query report_private collection filtered by reporterUserId
    const reportsQuery = query(
      collection(db, 'report_private'),
      where('reporterUserId', '==', userId),
      orderBy('reportId', 'desc') // Most recent first
    )

    const querySnap = await getDocs(reportsQuery)

    return querySnap.docs.map((docSnap) => {
      const data = docSnap.data() as ReportPrivate
      return {
        id: docSnap.id,
        reportId: data.reportId,
        incidentType: 'other', // Default, actual type is in public report
        status: 'pending' as const, // Default, actual status is in public report
        createdAt: Date.now(), // Approximation
        approximateLocation: {
          barangay: 'Unknown',
          municipality: 'Unknown',
        },
      }
    })
  } catch (error) {
    console.error('Failed to fetch user reports:', error)
    throw new Error('Failed to fetch user reports')
  }
}

/**
 * Fetch user's reports with full details
 *
 * Combines report_private data with public report data for complete view.
 *
 * @param userId - The user's UID
 * @returns Array of user's reports with full details
 */
export async function getUserReportsWithDetails(
  userId: string
): Promise<(UserReportSummary & { contactPhone?: string })[]> {
  try {
    // Query report_private collection
    const reportsQuery = query(
      collection(db, 'report_private'),
      where('reporterUserId', '==', userId),
      orderBy('reportId', 'desc')
    )

    const querySnap = await getDocs(reportsQuery)

    const reportsWithDetails: (UserReportSummary & { contactPhone?: string })[] = []

    for (const docSnap of querySnap.docs) {
      const privateData = docSnap.data() as ReportPrivate

      // Fetch public report data
      const publicReport = await getDocument<Report>('reports', privateData.reportId)

      reportsWithDetails.push({
        id: docSnap.id,
        reportId: privateData.reportId,
        incidentType: publicReport?.incidentType || 'other',
        status: publicReport?.status || 'pending',
        createdAt: publicReport?.createdAt || Date.now(),
        approximateLocation: publicReport?.approximateLocation || {
          barangay: 'Unknown',
          municipality: 'Unknown',
        },
        contactPhone: privateData.reporterContact?.phone,
      })
    }

    return reportsWithDetails
  } catch (error) {
    console.error('Failed to fetch user reports with details:', error)
    throw new Error('Failed to fetch user reports with details')
  }
}

/**
 * Export all user data for GDPR compliance
 *
 * Creates a JSON export of all user data including their reports.
 *
 * @param userId - The user's UID
 * @param userEmail - The user's email
 * @param userRole - The user's role
 * @param createdAt - Account creation timestamp
 * @returns User data export object
 */
export async function exportUserData(
  userId: string,
  userEmail: string,
  userRole: string,
  createdAt: number
): Promise<UserDataExport> {
  try {
    // Fetch user's reports
    const reports = await getUserReportsWithDetails(userId)

    // Build export object
    const exportData: UserDataExport = {
      exportedAt: Date.now(),
      user: {
        uid: userId,
        email: userEmail,
        role: userRole,
        createdAt,
      },
      reports,
    }

    return exportData
  } catch (error) {
    console.error('Failed to export user data:', error)
    throw new Error('Failed to export user data')
  }
}

/**
 * Delete all user data and account
 *
 * IMPORTANT: This requires the user to have recently re-authenticated.
 * Firebase Auth requires recent authentication before sensitive operations.
 *
 * Steps:
 * 1. Delete all user's private report data from report_private
 * 2. Delete all user's operational data from report_ops
 * 3. (Optional) Anonymize public reports instead of deleting
 * 4. Delete Firebase Auth user account
 *
 * @param userId - The user's UID
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  try {
    // Delegate to server-side callable which handles all cleanup atomically.
    // The Cloud Function deletes: auth user, users/{uid}, roles/{uid},
    // report_private records, and report_ops records.
    await callFunction('deleteUserData', { targetUserUid: userId })
  } catch (error) {
    throw new Error('Failed to delete account', { cause: error })
  }
}
