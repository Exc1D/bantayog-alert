import { normalizeReportType, normalizeSeverity, normalizeReportStatus } from '../constants/report'
import type { ReportDoc } from '../hooks/useFirestoreListeners'
import type { Report } from '../types'

function extractCreatedAt(doc: Record<string, unknown>): string {
  const raw = doc.submittedAt ?? doc.createdAt

  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return new Date(raw).toISOString()
  if (isFirebaseTimestamp(raw)) {
    const dt = raw.toDate()
    if (dt instanceof Date && !Number.isNaN(dt.getTime())) return dt.toISOString()
  }
  return ''
}

function isFirebaseTimestamp(value: unknown): value is { toDate: () => Date } {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  )
}

function firstNumber(...values: (number | undefined)[]): number | undefined {
  for (const v of values) {
    if (typeof v === 'number') return v
  }
  return undefined
}

function extractCoords(doc: Record<string, unknown>) {
  const publicLocation = asRecord(doc.publicLocation)
  const location = asRecord(doc.location)

  return {
    latitude: firstNumber(
      asNumber(publicLocation?.lat),
      asNumber(doc.latitude),
      asNumber(location?.latitude),
    ),
    longitude: firstNumber(
      asNumber(publicLocation?.lng),
      asNumber(doc.longitude),
      asNumber(location?.longitude),
    ),
  }
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}

function isValidCoord(lat: number | undefined, lng: number | undefined): { latitude: number; longitude: number } | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { latitude: lat, longitude: lng }
}

function firstNonEmpty(doc: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = doc[key]
    if (typeof value === 'string') return value
  }
  return ''
}

function mapCommonFields(doc: Record<string, unknown>): Omit<Report, 'latitude' | 'longitude'> {
  return {
    id: doc.id as string,
    type: normalizeReportType(doc.reportType ?? doc.type),
    severity: normalizeSeverity(doc.severity),
    municipality: firstNonEmpty(doc, 'municipalityLabel', 'municipality'),
    barangay: firstNonEmpty(doc, 'barangayId', 'barangay'),
    createdAt: extractCreatedAt(doc),
    status: normalizeReportStatus(doc.status),
    description: typeof doc.description === 'string' ? doc.description : '',
    reporterName: '',
    reporterPhone: '',
    updatedAt: '',
    ...(Array.isArray(doc.featuredMediaIds)
      ? { featuredMediaIds: doc.featuredMediaIds as string[] }
      : {}),
  }
}

export function mapReportDocToReport(doc: Record<string, unknown>): Report | null {
  const { latitude, longitude } = extractCoords(doc)
  const coords = isValidCoord(latitude, longitude)
  if (coords === null) return null
  return { ...mapCommonFields(doc), ...coords }
}

export function mapReportDocToReportLoose(doc: ReportDoc | Record<string, unknown>): Report {
  const d = doc as Record<string, unknown>
  const { latitude, longitude } = extractCoords(d)
  const coords = isValidCoord(latitude, longitude) ?? { latitude: 0, longitude: 0 }
  return { ...mapCommonFields(d), ...coords }
}
