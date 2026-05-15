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
} from 'lucide-react'
import type { ReportType } from '../types'

const TYPE_ICONS: Record<ReportType, typeof Waves> = {
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

const TYPE_LABELS: Record<ReportType, string> = {
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

interface Props {
  type: ReportType
}

export function ReportTypeIcon({ type }: Props) {
  const Icon = TYPE_ICONS[type]
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{TYPE_LABELS[type]}</span>
    </span>
  )
}
