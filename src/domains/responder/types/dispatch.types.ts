/**
 * Quick status options for responder updates
 */
export type QuickStatus = 'en_route' | 'on_scene' | 'needs_assistance' | 'completed'

/**
 * Urgency level for dispatch prioritization
 */
export type DispatchUrgency = 'low' | 'medium' | 'high'

/**
 * Incident location — simple lat/lng with optional address/landmark.
 * Distinct from LocationValue (ReportForm.tsx) which is a discriminated union
 * for gps vs manual entry, and from RichLocation which includes full GPS metadata.
 */
export interface AssignedDispatch {
  id: string
  type: 'rescue' | 'medical' | 'fire' | 'citizen_report'
  status: QuickStatus
  urgency: DispatchUrgency
  incidentLocation: {
    latitude: number
    longitude: number
    address?: string
    landmark?: string
  }
  assignedAt: number
  responderStatus?: QuickStatus
}

/**
 * Error types for dispatch operations
 */
export type DispatchesError =
  | { code: 'NETWORK_ERROR'; message: string; isFatal: boolean }
  | { code: 'PERMISSION_DENIED'; message: string; isFatal: true }
  | { code: 'VALIDATION_ERROR'; message: string; isFatal: false }
  | { code: 'AUTH_EXPIRED'; message: string; isFatal: true }

/**
 * Error types for quick status operations
 * Note: VALIDATING is a state marker (not an error) — use isValidating: boolean instead
 */
export type QuickStatusError =
  | { code: 'NOT_ASSIGNED'; message: string; isFatal: boolean }
  | { code: 'INVALID_STATUS'; message: string; isFatal: false }
  | { code: 'NETWORK_ERROR'; message: string; isFatal: boolean }
  | { code: 'PERMISSION_DENIED'; message: string; isFatal: true }
