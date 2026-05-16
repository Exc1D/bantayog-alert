import {
  Waves,
  Flame,
  Mountain,
  Car,
  HeartPulse,
  AlertTriangle,
  CloudLightning,
  Wind,
  Building,
  ShieldAlert,
  AlertCircle,
  Info,
  MinusCircle,
} from 'lucide-react'
import type { ReportType, Severity, ReportStatus } from '../types'

export const TYPE_ICONS: Record<ReportType, typeof Waves> = {
  flood: Waves,
  fire: Flame,
  earthquake: CloudLightning,
  typhoon: Wind,
  landslide: Mountain,
  storm_surge: Waves,
  medical: HeartPulse,
  accident: Car,
  structural: Building,
  security: ShieldAlert,
  other: AlertTriangle,
}

export const TYPE_LABELS: Record<ReportType, string> = {
  flood: 'Flood',
  fire: 'Fire',
  earthquake: 'Earthquake',
  typhoon: 'Typhoon',
  landslide: 'Landslide',
  storm_surge: 'Storm Surge',
  medical: 'Medical',
  accident: 'Accident',
  structural: 'Structural',
  security: 'Security',
  other: 'Other',
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
}

export const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; token: string; icon: typeof AlertTriangle }
> = {
  high: { label: 'HIGH', token: 'var(--color-severity-high)', icon: AlertTriangle },
  medium: { label: 'MED', token: 'var(--color-severity-medium)', icon: AlertCircle },
  low: { label: 'LOW', token: 'var(--color-severity-low)', icon: Info },
}

export const SEVERITY_ICON: Record<Severity, typeof AlertTriangle> = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: MinusCircle,
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
}

const REPORT_TYPE_VALUES: readonly string[] = [
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
  'other',
]

const SEVERITY_VALUES: readonly string[] = ['low', 'medium', 'high']

export function isValidReportType(value: unknown): value is ReportType {
  return typeof value === 'string' && REPORT_TYPE_VALUES.includes(value)
}

export function normalizeReportType(value: unknown): ReportType {
  if (value === 'public_disturbance') return 'security'
  return isValidReportType(value) ? value : 'other'
}

export function isValidSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && SEVERITY_VALUES.includes(value)
}

export function normalizeSeverity(value: unknown): Severity {
  return isValidSeverity(value) ? value : 'low'
}

const REPORT_STATUS_VALUES: readonly string[] = [
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
]

export function isValidReportStatus(value: unknown): value is ReportStatus {
  return typeof value === 'string' && REPORT_STATUS_VALUES.includes(value)
}

export function normalizeReportStatus(value: unknown): ReportStatus {
  return isValidReportStatus(value) ? value : 'new'
}
