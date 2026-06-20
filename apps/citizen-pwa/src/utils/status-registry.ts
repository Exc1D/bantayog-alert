import {
  AlertTriangle,
  Bell,
  BrickWall,
  Car,
  CheckCircle2,
  CircleX,
  CloudUpload,
  Flame,
  HeartPulse,
  HelpCircle,
  Info,
  MapPin,
  Megaphone,
  MountainSnow,
  Radio,
  Search,
  ShieldAlert,
  TrafficCone,
  Waves,
  Wind,
  Zap,
} from 'lucide-react'
import type { ComponentType } from 'react'

export type StatusIcon = ComponentType<{ size?: number; className?: string }>

export interface StatusPresentation {
  colorToken: string
  icon: StatusIcon
  label: string
}

export interface SeverityPresentation extends StatusPresentation {
  fg: string
  bg: string
  dotHex: string
}

const severity: Record<string, SeverityPresentation> = {
  critical: {
    colorToken: 'var(--color-severity-critical-fg)',
    fg: 'var(--color-severity-critical-fg)',
    bg: 'var(--color-severity-critical-bg)',
    dotHex: '#dc2626',
    icon: ShieldAlert,
    label: 'CRITICAL',
  },
  high: {
    colorToken: 'var(--color-severity-high-fg)',
    fg: 'var(--color-severity-high-fg)',
    bg: 'var(--color-severity-high-bg)',
    dotHex: '#dc2626',
    icon: AlertTriangle,
    label: 'HIGH',
  },
  medium: {
    colorToken: 'var(--color-severity-medium-fg)',
    fg: 'var(--color-severity-medium-fg)',
    bg: 'var(--color-severity-medium-bg)',
    dotHex: '#a73400',
    icon: Bell,
    label: 'MEDIUM',
  },
  low: {
    colorToken: 'var(--color-severity-low-fg)',
    fg: 'var(--color-severity-low-fg)',
    bg: 'var(--color-severity-low-bg)',
    dotHex: '#414849',
    icon: Info,
    label: 'LOW',
  },
}

const operationalStage: Record<string, StatusPresentation> = {
  saved: { colorToken: 'var(--surface-600)', icon: CloudUpload, label: 'Saved and sending' },
  received: { colorToken: 'var(--brand-600)', icon: Radio, label: 'Received' },
  being_reviewed: { colorToken: 'var(--warning-500)', icon: Search, label: 'Being reviewed' },
  response_coordinated: {
    colorToken: 'var(--success-500)',
    icon: MapPin,
    label: 'Response coordinated',
  },
  addressed: { colorToken: 'var(--success-500)', icon: CheckCircle2, label: 'Addressed' },
  not_accepted: { colorToken: 'var(--danger-500)', icon: CircleX, label: 'Not accepted' },
}

const hazardType: Record<string, StatusPresentation> = {
  fire: { colorToken: 'var(--danger-500)', icon: Flame, label: 'Fire' },
  flood: { colorToken: 'var(--brand-600)', icon: Waves, label: 'Flood' },
  earthquake: { colorToken: 'var(--warning-500)', icon: AlertTriangle, label: 'Earthquake' },
  typhoon: { colorToken: 'var(--info-500)', icon: Wind, label: 'Typhoon' },
  landslide: { colorToken: 'var(--warning-500)', icon: MountainSnow, label: 'Landslide' },
  storm_surge: { colorToken: 'var(--brand-600)', icon: Waves, label: 'Storm surge' },
  medical: { colorToken: 'var(--danger-500)', icon: HeartPulse, label: 'Medical' },
  accident: { colorToken: 'var(--warning-500)', icon: Car, label: 'Accident or rescue' },
  structural: { colorToken: 'var(--warning-500)', icon: BrickWall, label: 'Structural damage' },
  security: { colorToken: 'var(--danger-500)', icon: ShieldAlert, label: 'Security' },
  public_disturbance: {
    colorToken: 'var(--warning-500)',
    icon: Megaphone,
    label: 'Public disturbance',
  },
  power_outage: { colorToken: 'var(--warning-500)', icon: Zap, label: 'Power outage' },
  road_blocked: { colorToken: 'var(--warning-500)', icon: TrafficCone, label: 'Road blocked' },
  other: { colorToken: 'var(--surface-600)', icon: HelpCircle, label: 'Other' },
}

const freshness: Record<string, StatusPresentation> = {
  current: { colorToken: 'var(--success-500)', icon: Radio, label: 'Current' },
  stale: { colorToken: 'var(--warning-500)', icon: AlertTriangle, label: 'Stale' },
  unavailable: { colorToken: 'var(--surface-600)', icon: CircleX, label: 'Unavailable' },
  empty_confirmed: { colorToken: 'var(--brand-600)', icon: CheckCircle2, label: 'Checked' },
}

const DEFAULT_SEVERITY: SeverityPresentation = {
  colorToken: 'var(--color-severity-low-fg)',
  fg: 'var(--color-severity-low-fg)',
  bg: 'var(--color-severity-low-bg)',
  dotHex: '#414849',
  icon: Info,
  label: 'INFO',
}

const DEFAULT_STATUS: StatusPresentation = {
  colorToken: 'var(--surface-600)',
  icon: HelpCircle,
  label: 'Status unavailable',
}

export function getSeverityPresentation(value: string): SeverityPresentation {
  return severity[value] ?? DEFAULT_SEVERITY
}

export function getOperationalStagePresentation(value: string): StatusPresentation {
  return operationalStage[value] ?? DEFAULT_STATUS
}

export function getHazardTypePresentation(value: string): StatusPresentation {
  return hazardType[value] ?? DEFAULT_STATUS
}

export function getFreshnessPresentation(value: string): StatusPresentation {
  return freshness[value] ?? DEFAULT_STATUS
}
