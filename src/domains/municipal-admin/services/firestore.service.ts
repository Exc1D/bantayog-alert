/**
 * Municipal Admin Firestore Service
 *
 * Handles data access for municipal administrators.
 * Municipal admins can view and manage all data within their municipality.
 */

import { where, orderBy, limit, type QueryConstraint } from 'firebase/firestore'
import {
  getDocument,
  getCollection,
  updateDocument,
  addDocument,
} from '@/shared/services/firestore.service'
import type {
  Report,
  ReportPrivate,
  ReportOps,
  Responder,
  Alert,
  UserProfile,
} from '@/shared/types'

/**
 * Get all reports in municipality
 *
 * Fetches all reports within the admin's municipality.
 * Includes both verified and unverified reports.
 *
 * @param municipality - Municipality name
 */
export async function getMunicipalityReports(
  municipality: string
): Promise<Array<{ report: Report; private?: ReportPrivate }>> {
  if (!municipality) {
    throw new Error('municipality is required')
  }
  try {
    const constraints: QueryConstraint[] = [
      where('approximateLocation.municipality', '==', municipality),
      orderBy('createdAt', 'desc'),
      limit(100),
    ]

    const reports = await getCollection<Report>('reports', constraints)

    // Fetch private data for each report
    const results = await Promise.all(
      reports.map(async (report) => {
        const privateData = await getDocument<ReportPrivate>('report_private', report.id)
        return { report, private: privateData || undefined }
      })
    )

    return results
  } catch (error) {
    throw new Error('Failed to fetch municipality reports', {
      cause: error,
    })
  }
}

/**
 * Get report details (all three tiers)
 *
 * Fetches complete report data (public + private + operational).
 * Municipal admins can access all three tiers.
 *
 * @param reportId - Report ID
 */
export async function getReportDetails(reportId: string): Promise<{
  report: Report
  private?: ReportPrivate
  ops: ReportOps
} | null> {
  try {
    const report = await getDocument<Report>('reports', reportId)
    const privateData = await getDocument<ReportPrivate>('report_private', reportId)
    const ops = await getDocument<ReportOps>('report_ops', reportId)

    if (!report || !ops) {
      return null
    }

    return {
      report,
      private: privateData || undefined,
      ops,
    }
  } catch (error) {
    throw new Error('Failed to fetch report details', { cause: error })
  }
}

/**
 * Verify report
 *
 * Marks a report as verified by municipal admin.
 * Verification is required before a report can be assigned to responders.
 *
 * @param reportId - Report ID
 * @param adminUid - Admin's UID
 */
export async function verifyReport(reportId: string, adminUid: string): Promise<void> {
  try {
    const now = Date.now()

    await updateDocument<Report>('reports', reportId, {
      status: 'verified',
      verifiedAt: now,
      verifiedBy: adminUid,
    })

    // Add timeline entry
    const ops = await getDocument<ReportOps>('report_ops', reportId)
    if (ops) {
      await updateDocument<ReportOps>('report_ops', reportId, {
        timeline: [
          ...ops.timeline,
          {
            timestamp: now,
            action: 'report_verified',
            performedBy: adminUid,
            notes: 'Report verified by municipal admin',
          },
        ],
      })
    }
  } catch (error) {
    throw new Error('Failed to verify report', { cause: error })
  }
}

/**
 * Assign report to responder
 *
 * Assigns a verified report to a responder.
 * Creates or updates the incident record.
 *
 * @param reportId - Report ID
 * @param responderUid - Responder's UID
 * @param adminUid - Admin's UID
 */
export async function assignToResponder(
  reportId: string,
  responderUid: string,
  adminUid: string
): Promise<void> {
  // CRITICAL: Verify responder and report are in same municipality
  const report = await getDocument<Report>('reports', reportId)
  if (!report) {
    throw new Error('Report not found', { cause: { code: 'REPORT_NOT_FOUND' } })
  }

  const responder = await getDocument<UserProfile>('users', responderUid)
  if (!responder) {
    throw new Error('Responder not found', { cause: { code: 'RESPONDER_NOT_FOUND' } })
  }

  // Check if responder is assigned to the same municipality as the report
  const reportMunicipality = report.approximateLocation.municipality
  const responderMunicipality = responder.municipality

  if (!responderMunicipality || responderMunicipality !== reportMunicipality) {
    throw new Error(
      `Cannot assign responder: Cross-municipality assignment not allowed. Report is in "${reportMunicipality}" but responder is assigned to "${responderMunicipality || 'no municipality'}"`,
      { cause: { code: 'CROSS_MUNICIPALITY_ASSIGNMENT_NOT_ALLOWED' } }
    )
  }

  try {
    const now = Date.now()

    // Update operational report
    await updateDocument<ReportOps>('report_ops', reportId, {
      assignedTo: responderUid,
      assignedAt: now,
      assignedBy: adminUid,
      timeline: [
        {
          timestamp: now,
          action: 'responder_assigned',
          performedBy: adminUid,
          notes: `Assigned to responder ${responderUid}`,
        },
      ],
    })

    // Update report status
    await updateDocument<Report>('reports', reportId, {
      status: 'assigned',
    })
  } catch (error) {
    throw new Error('Failed to update documents', { cause: error })
  }
}

/**
 * Get available responders
 *
 * Fetches all responders in the municipality who are on duty and available.
 *
 * @param municipality - Municipality name
 */
export async function getAvailableResponders(_municipality: string): Promise<Responder[]> {
  try {
    // Note: This would require a responders_by_municipality index
    // For now, return empty array
    // In production, this would query the responders collection
    return []
  } catch (error) {
    throw new Error('Failed to fetch available responders', { cause: error })
  }
}

/**
 * Get municipality statistics
 *
 * Fetches summary statistics for the municipality.
 *
 * @param municipality - Municipality name
 */
export async function getMunicipalityStats(municipality: string): Promise<{
  totalReports: number
  pendingReports: number
  verifiedReports: number
  assignedReports: number
  resolvedReports: number
  activeIncidents: number
}> {
  try {
    const reports = await getCollection<Report>('reports', [
      where('approximateLocation.municipality', '==', municipality),
    ])

    return {
      totalReports: reports.length,
      pendingReports: reports.filter((r) => r.status === 'pending').length,
      verifiedReports: reports.filter((r) => r.status === 'verified').length,
      assignedReports: reports.filter((r) => r.status === 'assigned').length,
      resolvedReports: reports.filter((r) => r.status === 'resolved').length,
      activeIncidents: reports.filter((r) =>
        ['verified', 'assigned', 'responding'].includes(r.status)
      ).length,
    }
  } catch (error) {
    throw new Error('Failed to fetch municipality stats', { cause: error })
  }
}

/**
 * Create alert for municipality
 *
 * Sends a notification to all citizens or specific role in the municipality.
 *
 * @param alert - Alert data
 */
export async function createAlert(alert: Omit<Alert, 'id' | 'createdAt'>): Promise<string> {
  return addDocument('alerts', {
    ...alert,
    createdAt: Date.now(),
  })
}

/**
 * Mark report as false alarm
 *
 * Marks a report as false alarm (not a real incident).
 *
 * @param reportId - Report ID
 * @param notes - Explanation
 * @param adminUid - Admin's UID
 */
export async function markAsFalseAlarm(
  reportId: string,
  notes: string,
  adminUid: string
): Promise<void> {
  try {
    const now = Date.now()

    await updateDocument<Report>('reports', reportId, {
      status: 'false_alarm',
      resolvedAt: now,
      resolvedBy: adminUid,
      resolutionNotes: notes,
    })

    // Add timeline entry
    const ops = await getDocument<ReportOps>('report_ops', reportId)
    if (ops) {
      await updateDocument<ReportOps>('report_ops', reportId, {
        timeline: [
          ...ops.timeline,
          {
            timestamp: now,
            action: 'marked_false_alarm',
            performedBy: adminUid,
            notes,
          },
        ],
      })
    }
  } catch (error) {
    throw new Error('Failed to mark as false alarm', { cause: error })
  }
}
