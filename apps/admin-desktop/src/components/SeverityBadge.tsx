import { AlertTriangle, AlertCircle, MinusCircle } from 'lucide-react'
import type { Severity } from '../stores/commandCenterStore'

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; color: string; icon: typeof AlertTriangle }
> = {
  HIGH: { label: 'HIGH', color: '#a73400', icon: AlertTriangle },
  MEDIUM: { label: 'MED', color: '#7c3500', icon: AlertCircle },
  LOW: { label: 'LOW', color: '#414849', icon: MinusCircle },
}

interface Props {
  severity: Severity
}

export function SeverityBadge({ severity }: Props) {
  const cfg = SEVERITY_CONFIG[severity]
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${cfg.color}20`,
        color: cfg.color,
        border: `1px solid ${cfg.color}40`,
      }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  )
}
