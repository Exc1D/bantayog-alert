import {
  Flame,
  Droplets,
  Wind,
  AlertTriangle,
  Zap,
  Mountain,
  HelpCircle,
  Activity,
  Shield,
  Waves,
  Building,
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
  fire: (s) => <Flame size={s} />,
  flood: (s) => <Droplets size={s} />,
  earthquake: (s) => <Activity size={s} />,
  typhoon: (s) => <Wind size={s} />,
  landslide: (s) => <Mountain size={s} />,
  storm_surge: (s) => <Waves size={s} />,
  medical: (s) => <Zap size={s} />,
  accident: (s) => <AlertTriangle size={s} />,
  structural: (s) => <Building size={s} />,
  security: (s) => <Shield size={s} />,
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
