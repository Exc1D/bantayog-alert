/**
 * Structured logging helpers for Bantayog Alert Cloud Functions.
 *
 * Cloud Logging accepts structured JSON payloads. Using a typed helper ensures
 * every log entry has a consistent shape with machine-readable `code` and a
 * human-readable `message`, enabling efficient log filtering and alerting.
 */

/** Maximum character length for log dimension values (Cloud Logging limit). */
export const LOG_DIMENSION_MAX = 128

/**
 * Log event severity levels, matching Cloud Logging severity semantics.
 */
export type LogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

/**
 * A structured log entry suitable for Cloud Logging ingestion.
 * All string fields (message, dimension) are truncated to LOG_DIMENSION_MAX.
 */
export interface LogEntry {
  /** Unix epoch milliseconds when the entry was created. */
  timestamp: number
  severity: LogSeverity
  /**
   * BantayogErrorCode or a service-specific string.
   * Examples: 'VALIDATION_ERROR', 'requestUploadUrl.called'
   */
  code: string
  /**
   * Alias for monitoring filters expecting `event`.
   * Duplicates `code` for backward compatibility with existing Terraform filters.
   */
  event: string
  /** Human-readable description of the event. */
  message: string
  /**
   * Logical grouping dimension (e.g. 'processInboxItem', 'requestLookup').
   * Used for log-based alerting and log filtering in Cloud Console.
   */
  dimension: string
  /**
   * Optional structured payload. The contents are not pre-validated —
   * callers are responsible for ensuring the data is serializable.
   */
  data?: Record<string, unknown>
}

/**
 * Emit a structured log entry. In local development, serializes to console.
 * In Cloud Functions (GCP), the structured logger writes directly to
 * Cloud Logging with severity routing and log-based alerts.
 *
 * @param entry - Log entry fields (all except timestamp are required)
 * @returns The complete LogEntry with timestamp populated
 */
export function logEvent(entry: {
  severity: LogSeverity
  code: string
  message: string
  dimension: string
  data?: Record<string, unknown>
}): LogEntry {
  const dimension =
    entry.dimension.length > LOG_DIMENSION_MAX
      ? entry.dimension.substring(0, LOG_DIMENSION_MAX)
      : entry.dimension

  const logEntry: LogEntry = {
    timestamp: Date.now(),
    severity: entry.severity,
    code: entry.code,
    event: entry.code,
    message: entry.message,
    dimension,
    ...(entry.data !== undefined ? { data: entry.data } : {}),
  }

  // Route to appropriate console method so Cloud Logging reads correct severity.
  const json = JSON.stringify(logEntry)
  if (entry.severity === 'ERROR' || entry.severity === 'CRITICAL') {
    console.error(json)
  } else if (entry.severity === 'WARNING') {
    console.warn(json)
  } else if (entry.severity === 'INFO') {
    // Cloud Functions ingests stdout as structured JSON logs.
    // eslint-disable-next-line no-console
    console.info(json)
  } else {
    // DEBUG and any other value
    // eslint-disable-next-line no-console
    console.debug(json)
  }

  return logEntry
}

/**
 * Factory for logEvent with pre-bound dimension. Use when a single operation
 * (e.g. processInboxItem) emits multiple log entries.
 *
 * @example
 * const log = logDimension('processInboxItem')
 * log({ severity: 'INFO', code: 'PROCESS_START', message: 'Processing inbox item', data: { inboxId } })
 */
export function logDimension(dimension: string) {
  return (entry: Omit<Parameters<typeof logEvent>[0], 'dimension'>): LogEntry =>
    logEvent({ ...entry, dimension })
}
