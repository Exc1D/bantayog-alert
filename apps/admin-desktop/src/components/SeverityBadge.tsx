import { SEVERITY_CONFIG } from '../constants/report'
import type { Severity } from '../stores/commandCenterStore'

interface Props {
  severity: Severity
}

export function SeverityBadge({ severity }: Props) {
  // Runtime guard: defend against unmapped severity values
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.low
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
