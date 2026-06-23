import { alertColorClass, alertDotColor } from './alert-utils'

type AlertLevel = 'none' | 'amber' | 'red'

function SituationValue({
  value,
  unit,
  alert,
}: {
  value: number | string
  unit?: string
  alert: AlertLevel
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`font-mono text-sm font-semibold ${alertColorClass(alert)}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        {unit && <span className="text-xs font-normal text-[var(--color-text-muted)]">{unit}</span>}
      </span>
      {alert !== 'none' && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: alertDotColor(alert) }}
        />
      )}
    </span>
  )
}

interface StatusCenterProps {
  activeIncidents: number
  avgResponseTime: number | null
  pendingTriage: number
}

export function StatusCenter({
  activeIncidents,
  avgResponseTime,
  pendingTriage,
}: StatusCenterProps) {
  const activeAlert: AlertLevel =
    activeIncidents > 75 ? 'red' : activeIncidents > 50 ? 'amber' : 'none'
  const responseAlert: AlertLevel =
    avgResponseTime == null
      ? 'none'
      : avgResponseTime > 20
        ? 'red'
        : avgResponseTime > 15
          ? 'amber'
          : 'none'
  const pendingAlert: AlertLevel = pendingTriage > 10 ? 'red' : pendingTriage > 5 ? 'amber' : 'none'

  return (
    <div className="flex flex-1 items-center justify-center gap-1 text-sm text-[var(--color-text-secondary)]">
      <SituationValue value={activeIncidents} alert={activeAlert} />
      <span className="text-xs text-[var(--color-text-muted)]">active</span>
      <span className="text-xs text-[var(--color-text-muted)]">·</span>
      <SituationValue
        value={avgResponseTime ?? '—'}
        unit={avgResponseTime == null ? undefined : 'm'}
        alert={responseAlert}
      />
      <span className="text-xs text-[var(--color-text-muted)]">avg response</span>
      <span className="text-xs text-[var(--color-text-muted)]">·</span>
      <SituationValue value={pendingTriage} alert={pendingAlert} />
      <span className="text-xs text-[var(--color-text-muted)]">pending</span>
    </div>
  )
}
