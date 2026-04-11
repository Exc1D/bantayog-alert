/**
 * IndexedDB Types
 *
 * Type definitions for offline report queue storage in IndexedDB.
 */

/**
 * Report queue status in offline storage
 */
export enum ReportStatus {
  PENDING = 'pending',
  UPLOADED = 'uploaded',
  ERROR = 'error',
}

/**
 * A report queued for offline storage
 *
 * Contains report data that will be synced when network is available.
 */
export interface ReportQueueItem {
  /** Unique identifier for the queued item */
  id: string
  /** ISO timestamp when the report was queued */
  timestamp: string
  /** The complete report data to be uploaded */
  data: unknown
  /** Current status of the queued report */
  status: ReportStatus
  /** Error message if status is ERROR */
  errorMessage?: string
  /** Number of retry attempts */
  retryCount?: number
  /** ISO timestamp of last sync attempt */
  lastSyncAttempt?: string
}

/**
 * Database schema version for IndexedDB
 * Increment this when making breaking schema changes
 */
export const DB_VERSION = 1

/**
 * IndexedDB configuration
 */
export const DB_CONFIG = {
  name: 'bantayog-offline-queue' as const,
  version: DB_VERSION,
  stores: {
    REPORTS: 'reports' as const,
  },
} as const

/**
 * Options for adding reports to the queue
 */
export interface AddReportOptions {
  /** Custom ID (optional, will generate if not provided) */
  id?: string
  /** Initial retry count (default: 0) */
  retryCount?: number
}

/**
 * Result of a batch operation
 */
export interface BatchResult {
  /** Number of successful operations */
  success: number
  /** Number of failed operations */
  failed: number
  /** Error messages from failed operations */
  errors: Array<{ id: string; error: string }>
}
