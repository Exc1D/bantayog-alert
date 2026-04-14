export interface SOSEvent {
  id: string
  status: 'active' | 'cancelled' | 'expired'
  responderId: string
  activatedAt: number
  expiresAt: number  // 4 hours from activation
  cancellationWindowEndsAt: number  // 30 seconds from activation
  location?: RichLocation
  cancelledAt?: number
  cancellationReason?: string
}

/**
 * Rich GPS location with metadata
 */
export interface RichLocation {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  altitudeAccuracy: number | null
  heading: number | null
  speed: number | null
  timestamp: number
  source: 'gps'
}

/**
 * Error types for SOS operations
 */
export type SOSError =
  | { code: 'ALREADY_ACTIVE'; message: string }
  | { code: 'VALIDATION_FAILED'; message: string }
  | { code: 'PERMISSION_DENIED'; message: string }
  | { code: 'NETWORK_ERROR'; message: string }
  | { code: 'SOS_OFFLINE'; message: string }
  | { code: 'GPS_TIMEOUT'; message: string }
  | { code: 'CANCEL_WINDOW_EXPIRED'; message: string }
  | { code: 'SOS_NOT_FOUND'; message: string }
  | { code: 'SOS_DUPLICATE'; message: string }
  | { code: 'INVALID_COORDS'; message: string }
  | { code: 'OUT_OF_RANGE'; message: string }

/**
 * Timeline entry for dispatch/SOS history
 */
export type TimelineEntry =
  | {
      type: 'status_change'
      from: string | null
      to: string
      timestamp: number
      actor: 'responder' | 'admin' | 'system'
      actorId: string
    }
  | {
      type: 'assigned'
      assignedTo: string
      assignedBy: string
      timestamp: number
    }
  | {
      type: 'note_added'
      note: string
      addedBy: string
      timestamp: number
    }
