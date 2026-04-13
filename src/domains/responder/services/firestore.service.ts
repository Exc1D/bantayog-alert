/**
 * Responder Firestore Service
 *
 * Handles data access for responders (emergency response personnel).
 * Responders can view assigned incidents and update response status.
 */

import { where, orderBy } from 'firebase/firestore'
import { getDocument, updateDocument, getCollection } from '@/shared/services/firestore.service'
import type { Report, ReportOps } from '@/shared/types'

/**
 * Get assigned incidents
 *
 * Fetches all reports currently assigned to the responder.
 * Responders can only see incidents they are assigned to.
 *
 * @param responderUid - Current responder's UID
 */
export async function getAssignedIncidents(
  responderUid: string
): Promise<Array<{ report: Report; ops: ReportOps }>> {
  try {
    // Fetch operational reports assigned to this responder
    const constraints = [where('assignedTo', '==', responderUid), orderBy('assignedAt', 'desc')]

    const opsReports = await getCollection<ReportOps>('report_ops', constraints)

    // Fetch corresponding public reports
    const results = await Promise.all(
      opsReports.map(async (ops) => {
        const report = await getDocument<Report>('reports', ops.reportId)
        return { report: report!, ops }
      })
    )

    return results.filter((r) => r.report !== null)
  } catch (error) {
    throw new Error('Failed to fetch assigned incidents', { cause: error })
  }
}

/**
 * Get incident details
 *
 * Fetches full incident details (public + operational).
 * Responders can only view incidents they are assigned to.
 *
 * @param reportId - Report ID
 * @param responderUid - Current responder's UID (for authorization check)
 */
export async function getIncidentDetails(
  reportId: string,
  responderUid: string
): Promise<{ report: Report; ops: ReportOps } | null> {
  try {
    const report = await getDocument<Report>('reports', reportId)
    const ops = await getDocument<ReportOps>('report_ops', reportId)

    if (!report || !ops) {
      return null
    }

    // Authorization check: responder can only view assigned incidents
    if (ops.assignedTo !== responderUid) {
      throw new Error('Unauthorized: Not assigned to this incident')
    }

    return { report, ops }
  } catch (error) {
    throw new Error('Failed to fetch incident details', { cause: error })
  }
}

/**
 * Update responder status
 *
 * Updates the responder's current status (en_route, on_scene, etc.)
 * for an assigned incident.
 *
 * @param reportId - Report ID
 * @param status - Responder status
 * @param notes - Optional notes
 * @param responderUid - Current responder's UID
 */
export async function updateResponderStatus(
  reportId: string,
  status: 'en_route' | 'on_scene' | 'awaiting_backup' | 'completed',
  notes?: string,
  responderUid?: string
): Promise<void> {
  try {
    const now = Date.now()

    await updateDocument<ReportOps>('report_ops', reportId, {
      responderStatus: status,
      responderNotes: notes,
      ...(status === 'en_route' && { responderDepartureTime: now }),
      ...(status === 'on_scene' && { responderArrivalTime: now }),
      timeline: [
        {
          timestamp: now,
          action: `status_${status}`,
          performedBy: responderUid || 'unknown',
          notes: notes || `Status updated to ${status}`,
        },
      ],
    })
  } catch (error) {
    throw new Error('Failed to update responder status', { cause: error })
  }
}

/**
 * Add timeline note
 *
 * Adds a note to the incident's operational timeline.
 *
 * @param reportId - Report ID
 * @param note - Timeline note
 * @param responderUid - Current responder's UID
 */
export async function addTimelineNote(
  reportId: string,
  note: string,
  responderUid: string
): Promise<void> {
  try {
    const ops = await getDocument<ReportOps>('report_ops', reportId)

    if (!ops) {
      throw new Error('Operational report not found')
    }

    // Authorization check
    if (ops.assignedTo !== responderUid) {
      throw new Error('Unauthorized: Not assigned to this incident')
    }

    const newTimelineEntry = {
      timestamp: Date.now(),
      action: 'note_added',
      performedBy: responderUid,
      notes: note,
    }

    await updateDocument<ReportOps>('report_ops', reportId, {
      timeline: [...ops.timeline, newTimelineEntry],
    })
  } catch (error) {
    throw new Error('Failed to add timeline note', { cause: error })
  }
}
