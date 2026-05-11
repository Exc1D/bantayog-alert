import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { Severity } from '../stores/commandCenterStore'

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; token: string; icon: typeof AlertTriangle }
> = {
  HIGH: { label: 'HIGH', token: 'var(--color-severity-high)', icon: AlertTriangle },
  MEDIUM: { label: 'MED', token: 'var(--color-severity-medium)', icon: AlertCircle },
  LOW: { label: 'LOW', token: 'var(--color-severity-low)', icon: Info },
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
        backgroundColor: `color-mix(in srgb, ${cfg.token} 12%, transparent)`,
        color: cfg.token,
        border: `1px solid color-mix(in srgb, ${cfg.token} 25%, transparent)`,
      }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  )
}
