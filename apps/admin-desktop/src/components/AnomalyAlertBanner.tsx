import { AlertTriangle, X } from 'lucide-react'
import { SEVERITY_ICON, SEVERITY_COLOR } from '../constants/report'
import type { AnomalyAlert } from '../types'

interface Props {
  alerts: AnomalyAlert[]
  onDismissAll: () => void
}

export function AnomalyAlertBanner({ alerts, onDismissAll }: Props) {
  const activeAlerts = alerts.filter((a) => !a.dismissedAt)
  if (activeAlerts.length === 0) return null

  const highestSeverity = activeAlerts.find((a) => a.severity === 'high')
    ? 'high'
    : activeAlerts.find((a) => a.severity === 'medium')
      ? 'medium'
      : 'low'

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const Icon = SEVERITY_ICON[highestSeverity] ?? AlertTriangle
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const color = SEVERITY_COLOR[highestSeverity] ?? 'var(--color-text-muted)'

  const firstAlert = activeAlerts[0]
  const summary =
    activeAlerts.length === 1 && firstAlert
      ? firstAlert.message
      : `${String(activeAlerts.length)} anomalies detected — highest: ${highestSeverity}`

  return (
    <div
      className="relative mb-4 flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3"
      style={{
        borderColor: color,
      }}
      role="alert"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <Icon className="relative z-10 h-5 w-5 shrink-0" style={{ color }} aria-hidden="true" />
      <p className="relative z-10 flex-1 text-sm" style={{ color }}>
        {summary}
      </p>
      <button
        type="button"
        onClick={onDismissAll}
        className="relative z-10 rounded p-1 hover:bg-white/10"
        aria-label="Dismiss all alerts"
      >
        <X className="h-4 w-4" style={{ color }} aria-hidden="true" />
      </button>
    </div>
  )
}
