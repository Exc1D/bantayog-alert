/**
 * Report Submission Service
 *
 * Centralized submission logic that coordinates report persistence and photo upload.
 * Used by both online form submission and offline queue sync.
 */

import { submitReport } from '@/domains/citizen/services/firestore.service'
import { uploadReportPhoto } from './reportStorage.service'
import type { IncidentType } from '@/shared/types/firestore.types'

export async function submitCitizenReport(reportData: {
  incidentType: string
  photo: File | null
  location: {
    type: 'gps' | 'manual'
    latitude?: number
    longitude?: number
    municipality?: string
    barangay?: string
  }
  phone: string
  isAnonymous: boolean
}): Promise<{ reportId: string; photoUrls: string[] }> {
  const VALID_INCIDENT_TYPES = [
    'flood', 'earthquake', 'landslide', 'fire',
    'typhoon', 'medical_emergency', 'accident',
    'infrastructure', 'crime', 'other',
  ] as const

  const incidentType = (VALID_INCIDENT_TYPES.includes(
    reportData.incidentType as typeof VALID_INCIDENT_TYPES[number]
  )
    ? reportData.incidentType
    : 'other') as IncidentType

  const publicReportData = {
    // Severity is hardcoded to 'medium' for now. Deriving from incident type would
    // require a severity mapping (e.g. earthquake/landslide = 'high', crime = 'medium),
    // which is out of scope for the current task and should be addressed separately.
    severity: 'medium' as const,
    approximateLocation: {
      barangay: reportData.location.type === 'manual' ? reportData.location.barangay ?? '' : 'Unknown',
      municipality: reportData.location.type === 'manual' ? reportData.location.municipality ?? '' : 'Unknown',
      approximateCoordinates:
        reportData.location.type === 'gps'
          ? {
              latitude: reportData.location.latitude ?? 0,
              longitude: reportData.location.longitude ?? 0,
            }
          : { latitude: 0, longitude: 0 },
    },
    description: `Reported ${reportData.incidentType} incident`,
    isAnonymous: reportData.isAnonymous,
    // Reporter name is hardcoded to 'Citizen Reporter' for anonymous-submitted reports.
    // Authenticated flow (logged-in citizen) should pass the user's display name,
    // but that wiring is out of scope for this task.
  }

  // reporterContact name intentionally uses 'Anonymous' / 'Citizen Reporter' — see above.
  const reportId = await submitReport({ ...publicReportData, incidentType }, {
    exactLocation: {
      address:
        reportData.location.type === 'manual'
          ? `${reportData.location.barangay ?? ''}, ${reportData.location.municipality ?? ''}`
          : `${reportData.location.latitude ?? 0}, ${reportData.location.longitude ?? 0}`,
      coordinates: {
        latitude: reportData.location.latitude ?? 0,
        longitude: reportData.location.longitude ?? 0,
      },
    },
    reporterContact: {
      name: reportData.isAnonymous ? 'Anonymous' : 'Citizen Reporter',
      phone: reportData.phone,
    },
  })

  let photoUrls: string[] = []
  if (reportData.photo !== null) {
    try {
      photoUrls = [await uploadReportPhoto(reportData.photo, reportId)]
    } catch (photoError) {
      console.error('[REPORT_SUBMISSION_PHOTO_ERROR]', photoError)
    }
  }

  return { reportId, photoUrls }
}