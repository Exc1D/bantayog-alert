import { AlertTriangle, AlertCircle, MinusCircle } from 'lucide-react'
import type { AnomalyAlert, Severity } from '../types'
import { SEVERITY_COLORS } from '../styles/severity-colors'

interface Props {
  alerts: AnomalyAlert[]
  onDismiss: (id: string, reason: string) => void
}

const SEVERITY_ICON: Record<Severity, typeof AlertTriangle> = {
  HIGH: AlertTriangle,
  MEDIUM: AlertCircle,
  LOW: MinusCircle,
}

export function AnomalyAlertPanel({ alerts, onDismiss }: Props) {
  const activeAlerts = alerts.filter((a) => !a.dismissedAt)

  if (activeAlerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)]">
        <p className="text-sm">No anomalies detected</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeAlerts.map((alert) => {
        const Icon = SEVERITY_ICON[alert.severity]
        const color = SEVERITY_COLORS[alert.severity]
        return (
          <div
            key={alert.id}
            className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {alert.municipality}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{alert.message}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onDismiss(alert.id, 'investigating')
                }}
                className="rounded px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-white/10"
              >
                Investigating
              </button>
              <button
                type="button"
                onClick={() => {
                  onDismiss(alert.id, 'false_positive')
                }}
                className="rounded px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-white/10"
              >
                False Positive
              </button>
              <button
                type="button"
                onClick={() => {
                  onDismiss(alert.id, 'resolved')
                }}
                className="rounded px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-white/10"
              >
                Resolved
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
