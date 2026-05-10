import { Waves, Flame, Mountain, Car, HeartPulse, AlertTriangle } from 'lucide-react'
import type { ReportType } from '../types'

const TYPE_ICONS: Record<ReportType, typeof Waves> = {
  FLOOD: Waves,
  FIRE: Flame,
  LANDSLIDE: Mountain,
  ACCIDENT: Car,
  MEDICAL: HeartPulse,
  OTHER: AlertTriangle,
}

const TYPE_LABELS: Record<ReportType, string> = {
  FLOOD: 'Flood',
  FIRE: 'Fire',
  LANDSLIDE: 'Landslide',
  ACCIDENT: 'Accident',
  MEDICAL: 'Medical',
  OTHER: 'Other',
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
