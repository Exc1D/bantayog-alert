import type { PublicIncident } from '../components/MapTab/types.js'

const VALID_REPORT_TYPES = new Set([
  'flood',
  'fire',
  'earthquake',
  'typhoon',
  'landslide',
  'storm_surge',
  'medical',
  'accident',
  'structural',
  'security',
  'power_outage',
  'other',
])

const VALID_SEVERITIES = new Set(['low', 'medium', 'high'])

const VALID_STATUSES = new Set([
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isPublicIncidentData(value: unknown): value is Omit<PublicIncident, 'id'> {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  const location = data.publicLocation
  const verifiedAtValid = data.verifiedAt === undefined || isFiniteNumber(data.verifiedAt)

  return (
    typeof data.reportType === 'string' &&
    VALID_REPORT_TYPES.has(data.reportType) &&
    typeof data.severity === 'string' &&
    VALID_SEVERITIES.has(data.severity) &&
    typeof data.status === 'string' &&
    VALID_STATUSES.has(data.status) &&
    typeof data.barangayId === 'string' &&
    typeof data.municipalityLabel === 'string' &&
    isFiniteNumber(data.submittedAt) &&
    verifiedAtValid &&
    !!location &&
    typeof location === 'object' &&
    isFiniteNumber((location as Record<string, unknown>).lat) &&
    isFiniteNumber((location as Record<string, unknown>).lng)
  )
}
