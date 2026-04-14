/**
 * Time constants for responder operations.
 * Note: SOS-related constants (30s window, 4hr expiration) are defined
 * in urgency.config.ts to keep them co-located with their domain logic.
 */
export const FOUR_MINUTES_MS = 4 * 60 * 1000
export const OPTIMISTIC_TIMEOUT_MS = 30 * 1000  // 30 seconds — also used for optimistic UI rollback
export const MAX_SYNC_RETRIES = 5
export const SYNC_RETRY_DELAY_MS = 1000
export const SYNC_MAX_DELAY_MS = 30000
