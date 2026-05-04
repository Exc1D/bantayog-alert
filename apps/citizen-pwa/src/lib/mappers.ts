import type { ReportStatus } from '@bantayog/shared-types'
import type { ReportData } from '../hooks/useReport'

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

export function mapReportFromFirestore(data: Record<string, unknown>): ReportData {
  if (typeof data.status !== 'string') {
    throw new Error('Invalid report data: missing required fields')
  }

  const createdAt = toMillis(data.createdAt) ?? toMillis(data.submittedAt)
  const updatedAt = toMillis(data.updatedAt) ?? toMillis(data.lastStatusAt)
  if (data.timeline !== undefined && !Array.isArray(data.timeline)) {
    throw new Error('Invalid report data: missing required fields')
  }
  const timeline = Array.isArray(data.timeline)
    ? data.timeline.map(mapTimelineEvent)
    : [
        ...(typeof createdAt === 'number' ? [{ event: 'new', timestamp: createdAt }] : []),
        ...(data.status !== 'new' && typeof updatedAt === 'number'
          ? [{ event: data.status, timestamp: updatedAt }]
          : []),
      ]

  const result: ReportData = {
    id: typeof data.id === 'string' ? data.id : 'unknown',
    status: data.status as ReportStatus,
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
