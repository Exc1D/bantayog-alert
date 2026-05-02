import {
  Waves,
  MountainSnow,
  Flame,
  Wind,
  BrickWall,
  Car,
  HeartPulse,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Megaphone,
  HelpCircle,
} from 'lucide-react'
import type { ReactNode } from 'react'

export const INCIDENT_TYPES = [
  'fire',
  'flood',
  'earthquake',
  'typhoon',
  'landslide',
  'storm_surge',
  'medical',
  'accident',
  'structural',
  'security',
  'public_disturbance',
  'power_outage',
  'other',
] as const

export type IncidentType = (typeof INCIDENT_TYPES)[number]

const ICON_MAP: Record<IncidentType, (size: number) => ReactNode> = {
  flood: (s) => <Waves size={s} />,
  landslide: (s) => <MountainSnow size={s} />,
  fire: (s) => <Flame size={s} />,
  typhoon: (s) => <Wind size={s} />,
  storm_surge: (s) => <Waves size={s} />,
  structural: (s) => <BrickWall size={s} />,
  accident: (s) => <Car size={s} />,
  medical: (s) => <HeartPulse size={s} />,
  security: (s) => <ShieldAlert size={s} />,
  earthquake: (s) => <AlertTriangle size={s} />,
  public_disturbance: (s) => <Megaphone size={s} />,
  power_outage: (s) => <Zap size={s} />,
  other: (s) => <HelpCircle size={s} />,
}

const LABEL_MAP: Record<IncidentType, string> = {
  fire: 'Fire',
  flood: 'Flood',
  earthquake: 'Earthquake',
  typhoon: 'Typhoon',
  landslide: 'Landslide',
  storm_surge: 'Storm Surge',
  medical: 'Medical',
  accident: 'Accidents/Rescue',
  structural: 'Damages',
  security: 'Security',
  public_disturbance: 'Public Disturbance',
  power_outage: 'Power Outage',
  other: 'Others',
}

export function incidentIcon(type: string, size = 16): ReactNode {
  if (type in ICON_MAP) return ICON_MAP[type as IncidentType](size)
  return <HelpCircle size={size} />
}

export function incidentLabel(type: string): string {
  if (type in LABEL_MAP) return LABEL_MAP[type as IncidentType]
  return type.replace(/_/g, ' ')
}

export function statusMeta(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'queued':
    case 'draft_inbox':
      return { label: 'Sending…', bg: 'bg-surface-200', color: 'text-surface-600' }
    case 'new':
      return { label: 'Received', bg: 'bg-brand-100', color: 'text-brand-600' }
    case 'awaiting_verify':
      return { label: 'Under review', bg: 'bg-warning-400/20', color: 'text-warning-500' }
    case 'verified':
      return { label: 'Verified', bg: 'bg-brand-100', color: 'text-brand-600' }
    case 'assigned':
    case 'acknowledged':
      return { label: 'Help on the way', bg: 'bg-success-400/20', color: 'text-success-500' }
    case 'en_route':
      return { label: 'Responder en route', bg: 'bg-success-400/20', color: 'text-success-500' }
    case 'on_scene':
      return { label: 'On scene', bg: 'bg-success-400/20', color: 'text-success-500' }
    case 'resolved':
    case 'closed':
      return { label: 'Resolved', bg: 'bg-success-400/20', color: 'text-success-500' }
    case 'reopened':
      return { label: 'Re-opened', bg: 'bg-brand-100', color: 'text-brand-600' }
    case 'rejected':
      return { label: 'Not accepted', bg: 'bg-danger-400/20', color: 'text-danger-500' }
    case 'cancelled':
    case 'cancelled_false_report':
      return { label: 'Cancelled', bg: 'bg-surface-200', color: 'text-surface-600' }
    case 'merged_as_duplicate':
      return { label: 'Merged', bg: 'bg-surface-200', color: 'text-surface-600' }
    default:
      return { label: status.replace(/_/g, ' '), bg: 'bg-surface-200', color: 'text-surface-600' }
  }
}

const SEVERITY_COLORS: Record<string, string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#334155',
}

export function severityDotColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? '#334155'
}
