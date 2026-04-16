import type { AgencyRequestStatus, AgencyRequestType } from './enums'
import type { FirestoreTimestamp } from './auth'

/** agencies/{agencyId} */
export interface Agency {
  name: string
  code: string
  municipalityId?: string
  dispatchDefaults?: {
    high: number
    medium: number
    low: number
  }
}

/** agency_assistance_requests/{requestId} — §5.6 */
export interface AgencyAssistanceRequest {
  reportId: string
  requestedByMunicipalId: string
  requestedByMunicipality: string
  targetAgencyId: string
  requestType: AgencyRequestType
  message: string
  priority: 'urgent' | 'normal'
  status: AgencyRequestStatus
  declinedReason?: string
  fulfilledByDispatchIds: string[]
  createdAt: FirestoreTimestamp
  respondedAt?: FirestoreTimestamp
  expiresAt: FirestoreTimestamp
}
