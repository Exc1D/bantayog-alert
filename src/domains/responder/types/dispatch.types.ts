/**
 * Quick status options for responder updates
 */
export type QuickStatus = 'en_route' | 'on_scene' | 'needs_assistance' | 'completed'

/**
 * Urgency level for dispatch prioritization
 */
export type DispatchUrgency = 'low' | 'medium' | 'high'

/**
 * Assigned dispatch as shown to responder
 */
export interface AssignedDispatch {
  id: string
  type: string  // 'rescue' | 'medical' | 'fire' | 'citizen_report'
  status: string
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

/**
 * Error types for quick status operations
 */
export type QuickStatusError =
  | { code: 'VALIDATING' }
  | { code: 'NOT_ASSIGNED'; message: string }
  | { code: 'INVALID_STATUS'; message: string }
  | { code: 'NETWORK_ERROR'; message: string }
