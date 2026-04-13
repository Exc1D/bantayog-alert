/**
 * Citizen Firestore Service
 *
 * Handles data access for citizens (general public).
 * Citizens can submit reports and view public report feed.
 * Anonymous reporting is supported.
 */

import { orderBy, limit } from 'firebase/firestore'
import { getDocument, getCollection, setDocument, addDocument } from '@/shared/services/firestore.service'
import type { Report, ReportPrivate } from '@/shared/types'

/**
 * Submit a new disaster report
 *
 * Creates all three tiers of report data (public, private, ops).
 * Returns the report ID.
 *
 * @param reportData - Public report data
 * @param privateData - Private report details (null if anonymous)
 * @returns Report ID
 */
export async function submitReport(
  reportData: Omit<Report, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  privateData?: Omit<ReportPrivate, 'id' | 'reportId'>
): Promise<string> {
  try {
    const now = Date.now()

    // Tier 1: Create public report with auto-generated ID (collision-resistant)
    const reportId = await addDocument('reports', {
      ...reportData,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
    })

    // Tier 2: Create private report (if not anonymous) using the same ID
    if (privateData) {
      await setDocument('report_private', reportId, {
        id: reportId,
        reportId,
        ...privateData,
      })
    }

    // Tier 3: Create operational report using the same ID
    await setDocument('report_ops', reportId, {
      id: reportId,
      reportId,
      timeline: [
        {
          timestamp: now,
          action: 'report_created',
          performedBy: privateData?.reporterUserId || 'anonymous',
          notes: 'Initial report submitted',
        },
      ],
    })

    return reportId
  } catch (error) {
    throw new Error('Failed to submit report', { cause: error })
  }
}

/**
 * Get public report feed
 *
 * Fetches recent reports visible to all citizens.
 * Returns reports ordered by creation date (newest first).
 *
 * @param maxCount - Maximum number of reports to fetch (default: 50)
 */
export async function getPublicFeed(maxCount: number = 50): Promise<Report[]> {
  try {
    const constraints = [orderBy('createdAt', 'desc'), limit(maxCount)]

    return await getCollection<Report>('reports', constraints)
  } catch (error) {
    throw new Error('Failed to fetch public feed', { cause: error })
  }
}

/**
 * Get report by ID
 *
 * Fetches the public tier of a report.
 * Citizens can only access the public tier.
 */
export async function getReport(reportId: string): Promise<Report | null> {
  return getDocument<Report>('reports', reportId)
}
