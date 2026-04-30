import {
  Waves,
  MountainSnow,
  Flame,
  Wind,
  Building2,
  Car,
  HeartPulse,
  ShieldAlert,
  AlertTriangle,
  Zap,
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
  structural: (s) => <Building2 size={s} />,
  accident: (s) => <Car size={s} />,
  medical: (s) => <HeartPulse size={s} />,
  security: (s) => <ShieldAlert size={s} />,
  earthquake: (s) => <AlertTriangle size={s} />,
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
  accident: 'Accident',
  structural: 'Structural',
  security: 'Security',
  power_outage: 'Power Outage',
  other: 'Other',
}

export function incidentIcon(type: string, size = 16): ReactNode {
  if (type in ICON_MAP) return ICON_MAP[type as IncidentType](size)
  return <HelpCircle size={size} />
}

export function incidentLabel(type: string): string {
  if (type in LABEL_MAP) return LABEL_MAP[type as IncidentType]
  return type.replace(/_/g, ' ')
}
