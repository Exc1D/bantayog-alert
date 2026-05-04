import type { ReportStatus } from '@bantayog/shared-types'
import type { ReportData } from '../hooks/useReport'

const VALID_STATUSES: Set<string> = new Set([
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

function synthesizeTimeline(
  data: Record<string, unknown>,
  status: ReportStatus,
  createdAt: number | undefined,
  updatedAt: number | undefined,
): { event: string; timestamp: number }[] {
  const events: { event: string; timestamp: number }[] = []
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

function mapTimelineEvent(rawEvt: unknown, index: number) {
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

export function mapReportFromFirestore(
  data: Record<string, unknown>,
  docId?: string,
): ReportData {
  if (typeof data.status !== 'string' || !VALID_STATUSES.has(data.status)) {
    throw new Error('Invalid report data: missing required fields')
  }

  const status = data.status as ReportStatus

  const createdAt = toMillis(data.createdAt) ?? toMillis(data.submittedAt)
  const updatedAt = toMillis(data.updatedAt) ?? toMillis(data.lastStatusAt)
  if (data.timeline !== undefined && !Array.isArray(data.timeline)) {
    throw new Error('Invalid report data: missing required fields')
  }
  const timeline = Array.isArray(data.timeline)
    ? data.timeline.map(mapTimelineEvent)
    : synthesizeTimeline(data, status, createdAt, updatedAt)

  const result: ReportData = {
    id: typeof data.id === 'string' ? data.id : docId ?? 'unknown',
    status,
    timeline,
  }

  if (data.type !== undefined) {
    result.type = data.type as string
  }
  if (data.reportType !== undefined) {
    result.reportType = data.reportType as string
  }
  if (data.severity !== undefined) {
    result.severity = data.severity as string
  }
  if (createdAt !== undefined) {
    result.createdAt = createdAt
  }
  if (updatedAt !== undefined) {
    result.updatedAt = updatedAt
  }
  const rawLocation =
    data.location !== undefined && data.location !== null ? data.location : data.publicLocation
  if (rawLocation !== undefined && rawLocation !== null && typeof rawLocation === 'object' && !Array.isArray(rawLocation)) {
    const loc = rawLocation as Record<string, unknown>
    result.location = {
      ...(typeof loc.address === 'string' && { address: loc.address }),
      ...(typeof loc.lat === 'number' && { lat: loc.lat }),
      ...(typeof loc.lng === 'number' && { lng: loc.lng }),
    }
  }
  if (data.reporterName !== undefined) {
    result.reporterName = data.reporterName as string
  }
  if (data.reporterPhone !== undefined) {
    result.reporterPhone = data.reporterPhone as string
  }
  if (data.resolutionNote !== undefined) {
    result.resolutionNote = data.resolutionNote as string
  }
  if (data.closedBy !== undefined) {
    result.closedBy = data.closedBy as string
  }

  return result
}
