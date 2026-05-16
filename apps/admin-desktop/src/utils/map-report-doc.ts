import { normalizeReportType, normalizeSeverity, normalizeReportStatus } from '../constants/report'
import type { Report } from '../types'

function extractCreatedAt(doc: Record<string, unknown>): string {
  const submittedAt = doc.submittedAt
  const createdAt = doc.createdAt

  // Prefer submittedAt (epoch ms) over createdAt for new-schema docs
  const raw = submittedAt ?? createdAt

  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return new Date(raw).toISOString()
  if (
    raw != null &&
    typeof raw === 'object' &&
    typeof (raw as { toDate?: unknown }).toDate === 'function'
  ) {
    const dt = (raw as { toDate: () => Date }).toDate()
    if (dt instanceof Date && !Number.isNaN(dt.getTime())) return dt.toISOString()
  }
  return ''
}

interface ExtractedCoords {
  latitude: number | undefined
  longitude: number | undefined
}

function extractCoords(doc: Record<string, unknown>): ExtractedCoords {
  const publicLocation =
    typeof doc.publicLocation === 'object' && doc.publicLocation !== null
      ? (doc.publicLocation as Record<string, unknown>)
      : undefined
  const location =
    typeof doc.location === 'object' && doc.location !== null
      ? (doc.location as Record<string, unknown>)
      : undefined

  const latitude =
    typeof publicLocation?.lat === 'number'
      ? publicLocation.lat
      : typeof doc.latitude === 'number'
        ? doc.latitude
        : typeof location?.latitude === 'number'
          ? location.latitude
          : undefined
  const longitude =
    typeof publicLocation?.lng === 'number'
      ? publicLocation.lng
      : typeof doc.longitude === 'number'
        ? doc.longitude
        : typeof location?.longitude === 'number'
          ? location.longitude
          : undefined

  return { latitude, longitude }
}

function getValidCoords(
  doc: Record<string, unknown>,
): { latitude: number; longitude: number } | null {
  const { latitude, longitude } = extractCoords(doc)
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null
  }
  return { latitude, longitude }
}

function mapCommonFields(doc: Record<string, unknown>): Omit<Report, 'latitude' | 'longitude'> {
  const municipality =
    typeof doc.municipalityLabel === 'string'
      ? doc.municipalityLabel
      : typeof doc.municipality === 'string'
        ? doc.municipality
        : ''
  const barangay =
    typeof doc.barangayId === 'string'
      ? doc.barangayId
      : typeof doc.barangay === 'string'
        ? doc.barangay
        : ''
  const description = typeof doc.description === 'string' ? doc.description : ''

  return {
    id: doc.id as string,
    type: normalizeReportType(doc.reportType ?? doc.type),
    severity: normalizeSeverity(doc.severity),
    municipality,
    barangay,
    createdAt: extractCreatedAt(doc),
    status: normalizeReportStatus(doc.status),
    description,
    reporterName: '',
    reporterPhone: '',
    updatedAt: '',
  }
}

export function mapReportDocToReport(doc: Record<string, unknown>): Report | null {
  const coords = getValidCoords(doc)
  if (coords === null) return null
  return {
    ...mapCommonFields(doc),
    ...coords,
  }
}

export function mapReportDocToReportLoose(doc: Record<string, unknown>): Report {
  const coords = getValidCoords(doc) ?? { latitude: 0, longitude: 0 }
  return {
    ...mapCommonFields(doc),
    ...coords,
  }
}
