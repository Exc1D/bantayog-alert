/**
 * Provincial Superadmin Firestore Service
 *
 * Handles data access for provincial superadmins.
 * Provincial superadmins have full visibility and control across the province.
 */

import { orderBy, limit } from 'firebase/firestore'
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
  Incident,
  Responder,
  Municipality,
  UserProfile,
  AuditLog,
} from '@/shared/types'

/**
 * Get all reports (province-wide)
 *
 * Fetches all reports across all municipalities.
 * Includes all three tiers of data.
 */
export async function getAllReports(): Promise<
  Array<{ report: Report; private?: ReportPrivate; ops: ReportOps }>
> {
  try {
    const constraints = [orderBy('createdAt', 'desc'), limit(500)]

    const reports = await getCollection<Report>('reports', constraints)

    // Fetch private and operational data for each report
    const results = await Promise.all(
      reports.map(async (report) => {
        const [privateData, ops] = await Promise.all([
          getDocument<ReportPrivate>('report_private', report.id),
          getDocument<ReportOps>('report_ops', report.id),
        ])

        return {
          report,
          private: privateData || undefined,
          ops: ops!,
        }
      })
    )

    return results
  } catch (error) {
    throw new Error('Failed to fetch all reports', { cause: error })
  }
}

/**
 * Get province-wide statistics
 *
 * Fetches aggregated statistics for the entire province.
 */
export async function getProvinceStats(): Promise<{
  totalReports: number
  totalMunicipalities: number
  totalResponders: number
  activeIncidents: number
  reportsByStatus: Record<string, number>
  reportsByMunicipality: Record<string, number>
  reportsByType: Record<string, number>
}> {
  try {
    const reports = await getCollection<Report>('reports', [limit(1000)])

    const municipalities = await getCollection<Municipality>('municipalities', [])

    const reportsByStatus: Record<string, number> = {}
    const reportsByMunicipality: Record<string, number> = {}
    const reportsByType: Record<string, number> = {}

    reports.forEach((report) => {
      reportsByStatus[report.status] = (reportsByStatus[report.status] || 0) + 1
      reportsByMunicipality[report.approximateLocation.municipality] =
        (reportsByMunicipality[report.approximateLocation.municipality] || 0) + 1
      reportsByType[report.incidentType] = (reportsByType[report.incidentType] || 0) + 1
    })

    return {
      totalReports: reports.length,
      totalMunicipalities: municipalities.length,
      totalResponders: municipalities.reduce((sum, m) => sum + m.totalResponders, 0),
      activeIncidents: reports.filter((r) =>
        ['verified', 'assigned', 'responding'].includes(r.status)
      ).length,
      reportsByStatus,
      reportsByMunicipality,
      reportsByType,
    }
  } catch (error) {
    throw new Error('Failed to fetch province stats', { cause: error })
  }
}

/**
 * Get all municipalities
 *
 * Fetches all municipalities in the province.
 */
export async function getMunicipalities(): Promise<Municipality[]> {
  return getCollection<Municipality>('municipalities', [])
}

/**
 * Get municipality details
 *
 * Fetches detailed information about a specific municipality.
 */
export async function getMunicipalityDetails(municipalityId: string): Promise<Municipality | null> {
  return getDocument<Municipality>('municipalities', municipalityId)
}

/**
 * Create municipal admin
 *
 * Creates a new municipal admin account for a specific municipality.
 *
 * @param email - Admin email
 * @param password - Admin password
 * @param displayName - Admin display name
 * @param municipality - Municipality assignment
 */
export async function createMunicipalAdmin(
  email: string,
  password: string,
  displayName: string,
  municipality: string
): Promise<void> {
  try {
    // This would be done via a Firebase Function in production
    // For now, we'll create a placeholder
    throw new Error('Use municipal admin registration service to create admin accounts')
  } catch (error) {
    throw new Error('Failed to create municipal admin', { cause: error })
  }
}

/**
 * Promote user to municipal admin
 *
 * Promotes an existing user to municipal admin role.
 *
 * @param uid - User UID
 * @param municipality - Municipality assignment
 * @param superadminUid - Current superadmin UID
 */
export async function promoteToMunicipalAdmin(
  uid: string,
  municipality: string,
  superadminUid: string
): Promise<void> {
  try {
    await updateDocument<UserProfile>('users', uid, {
      role: 'municipal_admin',
      municipality,
      updatedAt: Date.now(),
    })

    // Add to municipality's admin list
    // (This would query the municipality document)
  } catch (error) {
    throw new Error('Failed to promote user', { cause: error })
  }
}

/**
 * Demote municipal admin
 *
 * Demotes a municipal admin to citizen role.
 *
 * @param uid - User UID
 * @param superadminUid - Current superadmin UID
 */
export async function demoteMunicipalAdmin(uid: string, superadminUid: string): Promise<void> {
  try {
    await updateDocument<UserProfile>('users', uid, {
      role: 'citizen',
      municipality: undefined,
      updatedAt: Date.now(),
    })

    // Remove from municipality's admin list
  } catch (error) {
    throw new Error('Failed to demote admin', { cause: error })
  }
}

/**
 * Declare emergency
 *
 * Declares a state of calamity or emergency for the province or a municipality.
 * Only provincial superadmins can declare emergencies.
 *
 * @param incidentId - Incident ID
 * @param emergencyLevel - Type of emergency declaration
 * @param superadminUid - Current superadmin UID
 */
export async function declareEmergency(
  incidentId: string,
  emergencyLevel: 'state_of_calamity' | 'state_of_emergency',
  superadminUid: string
): Promise<void> {
  try {
    const now = Date.now()

    await updateDocument<Incident>('incidents', incidentId, {
      emergencyDeclared: true,
      emergencyDeclaredAt: now,
      emergencyDeclaredBy: superadminUid,
      emergencyLevel,
    })

    // Log the action
    await addAuditLog({
      timestamp: now,
      performedBy: superadminUid,
      performedByRole: 'provincial_superadmin',
      action: 'DECLARE_EMERGENCY',
      resourceType: 'incident',
      resourceId: incidentId,
      details: `Declared ${emergencyLevel} for incident ${incidentId}`,
    })
  } catch (error) {
    throw new Error('Failed to declare emergency', { cause: error })
  }
}

/**
 * Get all users
 *
 * Fetches all users in the system.
 * For user management and monitoring.
 */
export async function getAllUsers(): Promise<UserProfile[]> {
  return getCollection<UserProfile>('users', [])
}

/**
 * Get audit logs
 *
 * Fetches audit logs for accountability and monitoring.
 *
 * @param limitCount - Maximum number of logs to fetch
 */
export async function getAuditLogs(limitCount: number = 100): Promise<AuditLog[]> {
  return getCollection<AuditLog>('audit_logs', [orderBy('timestamp', 'desc'), limit(limitCount)])
}

/**
 * Add audit log entry
 *
 * Logs an administrative action for accountability.
 *
 * @param logData - Audit log data
 */
async function addAuditLog(logData: Omit<AuditLog, 'id'>): Promise<void> {
  await addDocument('audit_logs', logData)
}

/**
 * Configure data retention
 *
 * Sets up automatic data deletion policies (GDPR compliance).
 * Default is 6 months retention.
 */
export async function configureDataRetention(retentionMonths: number): Promise<void> {
  try {
    // This would configure a scheduled Firebase Function
    // to auto-delete data older than retentionMonths
    throw new Error('Data retention configuration not yet implemented')
  } catch (error) {
    throw new Error('Failed to configure data retention', { cause: error })
  }
}

/**
 * Force user logout
 *
 * Forces a user to log out by setting a flag in their profile.
 *
 * @param uid - User UID
 */
export async function forceUserLogout(uid: string): Promise<void> {
  try {
    await updateDocument<UserProfile>('users', uid, {
      forceLogout: true,
      updatedAt: Date.now(),
    })
  } catch (error) {
    throw new Error('Failed to force logout', { cause: error })
  }
}

/**
 * Get user sessions
 *
 * Fetches active sessions for a user (if session tracking is enabled).
 *
 * @param uid - User UID
 */
export async function getUserSessions(uid: string): Promise<unknown[]> {
  try {
    // This would query a user_sessions subcollection
    // For now, return empty array
    return []
  } catch (error) {
    throw new Error('Failed to fetch user sessions', { cause: error })
  }
}
