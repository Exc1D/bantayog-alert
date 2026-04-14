/**
 * Type validation tests for responder type definitions.
 *
 * These tests verify the exported types exist and have the correct structure.
 */

import { describe, it, expect } from 'vitest'
import type {
  // dispatch.types
  QuickStatus,
  DispatchUrgency,
  AssignedDispatch,
  DispatchesError,
  QuickStatusError,
  // sos.types
  SOSEvent,
  RichLocation,
  SOSError,
  TimelineEntry,
  // errors.types
  BaseError,
  FatalError,
  RecoverableError,
  ResponderError,
} from '../index'

// ---------------------------------------------------------------------------
// dispatch.types tests
// ---------------------------------------------------------------------------

describe('QuickStatus', () => {
  it('should be a union of valid status strings', () => {
    const statuses: QuickStatus[] = ['en_route', 'on_scene', 'needs_assistance', 'completed']
    expect(statuses).toHaveLength(4)
  })
})

describe('DispatchUrgency', () => {
  it('should be a union of valid urgency levels', () => {
    const urgencies: DispatchUrgency[] = ['low', 'medium', 'high']
    expect(urgencies).toHaveLength(3)
  })
})

describe('AssignedDispatch', () => {
  it('should accept valid dispatch object', () => {
    const dispatch: AssignedDispatch = {
      id: 'dispatch-1',
      type: 'rescue',
      status: 'assigned',
      urgency: 'high',
      incidentLocation: {
        latitude: 14.2972,
        longitude: 122.7417,
        address: '123 Main St',
        landmark: 'Near town hall',
      },
      assignedAt: Date.now(),
      responderStatus: 'en_route',
    }
    expect(dispatch.id).toBe('dispatch-1')
    expect(dispatch.urgency).toBe('high')
  })

  it('should accept minimal dispatch without optional fields', () => {
    const dispatch: AssignedDispatch = {
      id: 'dispatch-2',
      type: 'citizen_report',
      status: 'pending',
      urgency: 'low',
      incidentLocation: {
        latitude: 14.2972,
        longitude: 122.7417,
      },
      assignedAt: Date.now(),
    }
    expect(dispatch.responderStatus).toBeUndefined()
    expect(dispatch.incidentLocation.landmark).toBeUndefined()
  })
})

describe('DispatchesError', () => {
  it('should accept NETWORK_ERROR variant', () => {
    const error: DispatchesError = {
      code: 'NETWORK_ERROR',
      message: 'Connection failed',
      isFatal: false,
    }
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.isFatal).toBe(false)
  })

  it('should accept PERMISSION_DENIED variant', () => {
    const error: DispatchesError = {
      code: 'PERMISSION_DENIED',
      message: 'Access denied',
      isFatal: true,
    }
    expect(error.code).toBe('PERMISSION_DENIED')
    expect(error.isFatal).toBe(true)
  })

  it('should accept VALIDATION_ERROR variant', () => {
    const error: DispatchesError = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid data',
      isFatal: false,
    }
    expect(error.code).toBe('VALIDATION_ERROR')
  })
})

describe('QuickStatusError', () => {
  it('should accept VALIDATING variant', () => {
    const error: QuickStatusError = { code: 'VALIDATING' }
    expect(error.code).toBe('VALIDATING')
  })

  it('should accept NOT_ASSIGNED variant', () => {
    const error: QuickStatusError = { code: 'NOT_ASSIGNED', message: 'No dispatch assigned' }
    expect(error.code).toBe('NOT_ASSIGNED')
  })

  it('should accept INVALID_STATUS variant', () => {
    const error: QuickStatusError = { code: 'INVALID_STATUS', message: 'Unknown status' }
    expect(error.code).toBe('INVALID_STATUS')
  })

  it('should accept NETWORK_ERROR variant', () => {
    const error: QuickStatusError = { code: 'NETWORK_ERROR', message: 'Failed to update' }
    expect(error.code).toBe('NETWORK_ERROR')
  })
})

// ---------------------------------------------------------------------------
// sos.types tests
// ---------------------------------------------------------------------------

describe('RichLocation', () => {
  it('should accept valid GPS location', () => {
    const location: RichLocation = {
      latitude: 14.2972,
      longitude: 122.7417,
      accuracy: 10,
      altitude: 100,
      altitudeAccuracy: 5,
      heading: 180,
      speed: 5,
      timestamp: Date.now(),
      source: 'gps',
    }
    expect(location.source).toBe('gps')
    expect(location.altitude).toBe(100)
  })

  it('should accept location with null optional fields', () => {
    const location: RichLocation = {
      latitude: 14.2972,
      longitude: 122.7417,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      timestamp: Date.now(),
      source: 'gps',
    }
    expect(location.altitude).toBeNull()
    expect(location.heading).toBeNull()
  })
})

describe('SOSEvent', () => {
  it('should accept valid SOS event', () => {
    const sos: SOSEvent = {
      id: 'sos-1',
      status: 'active',
      responderId: 'responder-1',
      activatedAt: Date.now(),
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
      cancellationWindowEndsAt: Date.now() + 30 * 1000,
      location: {
        latitude: 14.2972,
        longitude: 122.7417,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        timestamp: Date.now(),
        source: 'gps',
      },
    }
    expect(sos.status).toBe('active')
    expect(sos.cancellationWindowEndsAt).toBeGreaterThan(sos.activatedAt)
  })

  it('should accept cancelled SOS event', () => {
    const sos: SOSEvent = {
      id: 'sos-2',
      status: 'cancelled',
      responderId: 'responder-1',
      activatedAt: Date.now() - 60000,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
      cancellationWindowEndsAt: Date.now() - 30000,
      cancelledAt: Date.now(),
      cancellationReason: 'False alarm',
    }
    expect(sos.status).toBe('cancelled')
    expect(sos.cancellationReason).toBe('False alarm')
  })
})

describe('SOSError', () => {
  it('should accept all error variants', () => {
    const errors: SOSError[] = [
      { code: 'ALREADY_ACTIVE', message: 'SOS already active' },
      { code: 'VALIDATION_FAILED', message: 'Invalid data' },
      { code: 'PERMISSION_DENIED', message: 'Access denied' },
      { code: 'NETWORK_ERROR', message: 'Connection failed' },
      { code: 'SOS_OFFLINE', message: 'Offline mode' },
      { code: 'GPS_TIMEOUT', message: 'GPS timed out' },
      { code: 'CANCEL_WINDOW_EXPIRED', message: 'Too late to cancel' },
      { code: 'SOS_DUPLICATE', message: 'Duplicate SOS' },
    ]
    expect(errors).toHaveLength(8)
  })
})

describe('TimelineEntry', () => {
  it('should accept status_change entry', () => {
    const entry: TimelineEntry = {
      type: 'status_change',
      from: 'assigned',
      to: 'en_route',
      timestamp: Date.now(),
      actor: 'responder',
      actorId: 'responder-1',
    }
    expect(entry.type).toBe('status_change')
    expect(entry.from).toBe('assigned')
  })

  it('should accept assigned entry', () => {
    const entry: TimelineEntry = {
      type: 'assigned',
      assignedTo: 'responder-1',
      assignedBy: 'admin-1',
      timestamp: Date.now(),
    }
    expect(entry.type).toBe('assigned')
  })

  it('should accept note_added entry', () => {
    const entry: TimelineEntry = {
      type: 'note_added',
      note: 'Arrived on scene',
      addedBy: 'responder-1',
      timestamp: Date.now(),
    }
    expect(entry.type).toBe('note_added')
  })
})

// ---------------------------------------------------------------------------
// errors.types tests
// ---------------------------------------------------------------------------

describe('BaseError', () => {
  it('should accept valid base error', () => {
    const error: BaseError = {
      code: 'TEST_ERROR',
      message: 'Test error message',
      timestamp: Date.now(),
      context: { field: 'value' },
    }
    expect(error.code).toBe('TEST_ERROR')
    expect(error.context?.field).toBe('value')
  })

  it('should accept error without optional context', () => {
    const error: BaseError = {
      code: 'TEST_ERROR',
      message: 'Test error',
      timestamp: Date.now(),
    }
    expect(error.context).toBeUndefined()
  })
})

describe('FatalError', () => {
  it('should accept valid fatal error', () => {
    const error: FatalError = {
      code: 'AUTH_EXPIRED',
      message: 'Session expired',
      timestamp: Date.now(),
      type: 'FATAL',
      category: 'AUTH_EXPIRED',
      userAction: 'RELOGIN',
    }
    expect(error.type).toBe('FATAL')
    expect(error.userAction).toBe('RELOGIN')
  })

  it('should accept PERMISSION_DENIED category', () => {
    const error: FatalError = {
      code: 'PERMISSION_DENIED',
      message: 'Access denied',
      timestamp: Date.now(),
      type: 'FATAL',
      category: 'PERMISSION_DENIED',
      userAction: 'CONTACT_ADMIN',
    }
    expect(error.category).toBe('PERMISSION_DENIED')
  })
})

describe('RecoverableError', () => {
  it('should accept valid recoverable error', () => {
    const error: RecoverableError = {
      code: 'NETWORK_ERROR',
      message: 'Connection lost',
      timestamp: Date.now(),
      type: 'RECOVERABLE',
      category: 'NETWORK_ERROR',
      retryable: true,
      retryAfter: 5000,
    }
    expect(error.type).toBe('RECOVERABLE')
    expect(error.retryable).toBe(true)
    expect(error.retryAfter).toBe(5000)
  })

  it('should accept non-retryable error', () => {
    const error: RecoverableError = {
      code: 'SERVER_ERROR',
      message: 'Server error',
      timestamp: Date.now(),
      type: 'RECOVERABLE',
      category: 'SERVER_ERROR',
      retryable: false,
    }
    expect(error.retryable).toBe(false)
    expect(error.retryAfter).toBeUndefined()
  })
})

describe('ResponderError', () => {
  it('should accept FatalError', () => {
    const error: ResponderError = {
      code: 'AUTH_EXPIRED',
      message: 'Session expired',
      timestamp: Date.now(),
      type: 'FATAL',
      category: 'AUTH_EXPIRED',
      userAction: 'RELOGIN',
    }
    expect(error.type).toBe('FATAL')
  })

  it('should accept RecoverableError', () => {
    const error: ResponderError = {
      code: 'NETWORK_ERROR',
      message: 'Connection lost',
      timestamp: Date.now(),
      type: 'RECOVERABLE',
      category: 'NETWORK_ERROR',
      retryable: true,
    }
    expect(error.type).toBe('RECOVERABLE')
  })
})
