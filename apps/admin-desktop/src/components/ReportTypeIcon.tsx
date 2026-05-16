import { AlertTriangle } from 'lucide-react'
import { TYPE_ICONS, TYPE_LABELS } from '../constants/report'
import type { ReportType } from '../types'

interface Props {
  type: ReportType
}

export function ReportTypeIcon({ type }: Props) {
  // Runtime guard: Firestore may contain legacy/unknown type values
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const Icon = TYPE_ICONS[type] ?? AlertTriangle
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const label = TYPE_LABELS[type] ?? 'Unknown'
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
