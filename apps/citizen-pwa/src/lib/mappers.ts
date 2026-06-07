import type { ReportStatus } from '@bantayog/shared-types'
import type { ReportData, ReportLocation, ReportTimelineEvent } from '../hooks/useReport'

function toMillis(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return value
  }
  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    const millis = value.toMillis()
    return typeof millis === 'number' ? millis : undefined
  }
  return undefined
}

const VALID_STATUSES: ReadonlySet<string> = new Set([
  'draft_inbox',
  'new',
  'awaiting_verify',
  'verified',
  'assigned',
  'acknowledged',
  'en_route',
  'on_scene',
  'resolved',
  'closed',
  'reopened',
  'rejected',
  'cancelled',
  'cancelled_false_report',
  'merged_as_duplicate',
])

// Per-step timestamp fields written by callables (verifyReport, dispatchResponder,
// closeReport, rejectReport, etc.). Each maps to a corresponding ReportStatus
// transition the citizen wants to see in the tracking timeline.
const TIMESTAMP_TO_EVENT: ReadonlyArray<{ field: string; event: ReportStatus }> = [
  { field: 'verifiedAt', event: 'verified' },
  { field: 'assignedAt', event: 'assigned' },
  { field: 'acknowledgedAt', event: 'acknowledged' },
  { field: 'enRouteAt', event: 'en_route' },
  { field: 'onSceneAt', event: 'on_scene' },
  { field: 'resolvedAt', event: 'resolved' },
  { field: 'closedAt', event: 'closed' },
  { field: 'rejectedAt', event: 'rejected' },
  { field: 'cancelledAt', event: 'cancelled' },
  { field: 'reopenedAt', event: 'reopened' },
]

/* ── validation ─────────────────────────────────────────── */

function assertValidStatus(status: unknown): asserts status is ReportStatus {
  if (typeof status !== 'string' || !VALID_STATUSES.has(status)) {
    throw new Error('Invalid report data: missing required fields')
  }
}

function assertValidTimeline(data: Record<string, unknown>): void {
  if (data.timeline !== undefined && !Array.isArray(data.timeline)) {
    throw new Error('Invalid report data: missing required fields')
  }
}

/* ── timestamp resolution ───────────────────────────────── */

function resolveCreatedAt(data: Record<string, unknown>): number | undefined {
  return toMillis(data.createdAt) ?? toMillis(data.submittedAt)
}

function resolveUpdatedAt(data: Record<string, unknown>): number | undefined {
  return toMillis(data.updatedAt) ?? toMillis(data.lastStatusAt)
}

/* ── timeline builders ──────────────────────────────────── */

function synthesizeTimeline(
  data: Record<string, unknown>,
  status: ReportStatus,
  createdAt: number | undefined,
  updatedAt: number | undefined,
): ReportTimelineEvent[] {
  const events: ReportTimelineEvent[] = []
  if (typeof createdAt === 'number') {
    events.push({ event: 'new', timestamp: createdAt })
  }

  const seen = new Set<string>(['new'])
  for (const { field, event } of TIMESTAMP_TO_EVENT) {
    const ts = toMillis(data[field])
    if (typeof ts === 'number' && !seen.has(event)) {
      events.push({ event, timestamp: ts })
      seen.add(event)
    }
  }

  // Fallback: if the current status didn't get a dedicated timestamp, fall back
  // to updatedAt so the user still sees their report has progressed.
  if (status !== 'new' && !seen.has(status) && typeof updatedAt === 'number') {
    events.push({ event: status, timestamp: updatedAt })
  }

  events.sort((a, b) => a.timestamp - b.timestamp)
  return events
}

function mapTimelineEvent(rawEvt: unknown, index: number): ReportTimelineEvent {
  if (!rawEvt || typeof rawEvt !== 'object' || Array.isArray(rawEvt)) {
    throw new Error(`Invalid timeline event at index ${index}`)
  }
  const evt = rawEvt as Record<string, unknown>
  const timestamp = toMillis(evt.timestamp)
  if (typeof evt.event !== 'string' || timestamp === undefined) {
    throw new Error(`Invalid timeline event fields at index ${index}`)
  }
  return {
    event: evt.event,
    timestamp,
    ...(typeof evt.actor === 'string' && { actor: evt.actor }),
    ...(typeof evt.note === 'string' && { note: evt.note }),
  }
}

function buildTimeline(
  data: Record<string, unknown>,
  status: ReportStatus,
  createdAt: number | undefined,
  updatedAt: number | undefined,
): ReportTimelineEvent[] {
  assertValidTimeline(data)
  return Array.isArray(data.timeline)
    ? data.timeline.map(mapTimelineEvent)
    : synthesizeTimeline(data, status, createdAt, updatedAt)
}

/* ── field extractors ───────────────────────────────────── */

function extractId(data: Record<string, unknown>, docId?: string): string {
  return typeof data.id === 'string' ? data.id : docId ?? 'unknown'
}

function extractOptionalString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' ? value : undefined
}

function extractLocation(data: Record<string, unknown>): ReportLocation | undefined {
  const rawLocation =
    data.location !== undefined && data.location !== null
      ? data.location
      : data.publicLocation

  if (
    rawLocation == null ||
    typeof rawLocation !== 'object' ||
    Array.isArray(rawLocation)
  ) {
    return undefined
  }

  const loc = rawLocation as Record<string, unknown>
  const location: ReportLocation = {}
  if (typeof loc.address === 'string') location.address = loc.address
  if (typeof loc.lat === 'number') location.lat = loc.lat
  if (typeof loc.lng === 'number') location.lng = loc.lng
  return Object.keys(location).length > 0 ? location : undefined
}

/* ── public API ──────────────────────────────────────────── */

export function mapReportFromFirestore(
  data: Record<string, unknown>,
  docId?: string,
): ReportData {
  assertValidStatus(data.status)
  const status = data.status as ReportStatus

  const createdAt = resolveCreatedAt(data)
  const updatedAt = resolveUpdatedAt(data)
  const timeline = buildTimeline(data, status, createdAt, updatedAt)

  const result: ReportData = {
    id: extractId(data, docId),
    status,
    timeline,
  }

  const type = extractOptionalString(data, 'type')
  if (type !== undefined) result.type = type

  const reportType = extractOptionalString(data, 'reportType')
  if (reportType !== undefined) result.reportType = reportType

  const severity = extractOptionalString(data, 'severity')
  if (severity !== undefined) result.severity = severity

  if (createdAt !== undefined) result.createdAt = createdAt
  if (updatedAt !== undefined) result.updatedAt = updatedAt

  const location = extractLocation(data)
  if (location !== undefined) result.location = location

  const reporterName = extractOptionalString(data, 'reporterName')
  if (reporterName !== undefined) result.reporterName = reporterName

  const reporterPhone = extractOptionalString(data, 'reporterPhone')
  if (reporterPhone !== undefined) result.reporterPhone = reporterPhone

  const resolutionNote = extractOptionalString(data, 'resolutionNote')
  if (resolutionNote !== undefined) result.resolutionNote = resolutionNote

  const closedBy = extractOptionalString(data, 'closedBy')
  if (closedBy !== undefined) result.closedBy = closedBy

  return result
}
