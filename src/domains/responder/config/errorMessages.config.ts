/**
 * Valid error recovery actions — used in ERROR_MESSAGES.action field.
 * Typed to prevent silent typos like 'RELOGN' instead of 'RELOGIN'.
 */
export type ErrorAction =
  | 'RELOGIN'
  | 'REFRESH'
  | 'RETRY'
  | 'DISMISS'
  | 'VIEW_SOS'
  | 'RETRY_SYNC'
  | null

type ErrorSeverity = 'blocking' | 'warning' | 'info'

interface ErrorMessageEntry {
  title: string
  message: string
  actionLabel: string | null
  action: ErrorAction
  severity: ErrorSeverity
}

const ERROR_MESSAGE_ENTRY = {
  PERMISSION_DENIED: {
    title: 'Session Expired',
    message: 'Your login session has expired. Please sign in again to continue.',
    actionLabel: 'Sign In',
    action: 'RELOGIN',
    severity: 'blocking' as ErrorSeverity
  },

  VALIDATION_ERROR: {
    title: 'Unable to Update',
    message: 'This dispatch may have been reassigned or cancelled.',
    actionLabel: 'Refresh Dispatches',
    action: 'REFRESH',
    severity: 'warning' as ErrorSeverity
  },

  AUTH_EXPIRED: {
    title: 'Authentication Failed',
    message: 'Please sign in again to continue.',
    actionLabel: 'Sign In',
    action: 'RELOGIN',
    severity: 'blocking' as ErrorSeverity
  },

  NETWORK_ERROR: {
    title: 'Connection Lost',
    message: 'Status update queued. Will sync automatically when connection restores.',
    actionLabel: null,
    action: null,
    severity: 'info' as ErrorSeverity
  },

  TIMEOUT: {
    title: 'Request Timed Out',
    message: 'Server is taking too long to respond. Retrying...',
    actionLabel: null,
    action: null,
    severity: 'warning' as ErrorSeverity
  },

  SERVER_ERROR: {
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again.',
    actionLabel: 'Retry',
    action: 'RETRY',
    severity: 'warning' as ErrorSeverity
  },

  SOS_OFFLINE: {
    title: 'No Internet Connection',
    message: 'SOS signal requires an active internet connection. Move to an area with signal and try again.',
    actionLabel: 'Dismiss',
    action: 'DISMISS',
    severity: 'blocking' as ErrorSeverity
  },

  GPS_TIMEOUT: {
    title: 'Location Unavailable',
    message: 'Unable to get your GPS location. Move to an open area or try again.',
    actionLabel: 'Retry',
    action: 'RETRY',
    severity: 'warning' as ErrorSeverity
  },

  CANCEL_WINDOW_EXPIRED: {
    title: 'SOS Cannot Be Cancelled',
    message: 'The 30-second cancellation window has passed. Admins have been notified and are responding.',
    actionLabel: 'OK',
    action: 'DISMISS',
    severity: 'info' as ErrorSeverity
  },

  SOS_DUPLICATE: {
    title: 'SOS Already Active',
    message: 'You already have an active SOS signal. Cancel it before sending a new one.',
    actionLabel: 'View Active SOS',
    action: 'VIEW_SOS',
    severity: 'warning' as ErrorSeverity
  },

  SYNC_FAILED: {
    title: 'Sync Failed',
    message: 'Your status update from X time(s) ago could not be sent after 5 attempts. Tap to retry.',
    actionLabel: 'Retry Now',
    action: 'RETRY_SYNC',
    severity: 'warning' as ErrorSeverity
  }
} as const satisfies Record<string, ErrorMessageEntry>

export const ERROR_MESSAGES = ERROR_MESSAGE_ENTRY
