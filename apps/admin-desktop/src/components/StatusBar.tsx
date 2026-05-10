import { useCommandCenterStore } from '../stores/commandCenterStore'

interface Props {
  activeIncidents: number
  avgResponseTime: number // minutes
  pendingTriage: number
  resolvedToday: number
  municipalitiesWithIssues: { withIssues: number; total: number }
}

function Metric({
  label,
  value,
  unit,
  alert,
}: {
  label: string
  value: number
  unit?: string
  alert: 'none' | 'amber' | 'red'
}) {
  const alertColor = alert === 'red' ? '#ef4444' : alert === 'amber' ? '#f59e0b' : 'transparent'
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className="mt-1 font-mono text-[32px] font-medium leading-none text-[var(--color-text-primary)]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        {unit && <span className="ml-1 text-lg">{unit}</span>}
      </span>
      {alert !== 'none' && (
        <span className="mt-1 h-1 w-8 rounded-full" style={{ backgroundColor: alertColor }} />
      )}
    </div>
  )
}

export function StatusBar({
  activeIncidents,
  avgResponseTime,
  pendingTriage,
  resolvedToday,
  municipalitiesWithIssues,
}: Props) {
  const { statusBarExpandedOverride, toggleStatusBarExpanded } = useCommandCenterStore()
  const isSurge = pendingTriage > 5
  const expanded = statusBarExpandedOverride ?? !isSurge

  const activeAlert = activeIncidents > 75 ? 'red' : activeIncidents > 50 ? 'amber' : 'none'
  const responseAlert = avgResponseTime > 20 ? 'red' : avgResponseTime > 15 ? 'amber' : 'none'
  const pendingAlert = pendingTriage > 10 ? 'red' : pendingTriage > 5 ? 'amber' : 'none'

  return (
    <div
      className="sticky top-0 z-50 border-b border-[var(--color-navy)] bg-[var(--color-navy)]"
      style={
        isSurge
          ? {
              boxShadow: '0 0 40px rgba(167, 52, 0, 0.25)',
              borderLeft: '4px solid var(--color-sienna)',
            }
          : undefined
      }
    >
      <div className="flex items-center justify-around px-4 py-3">
        <Metric label="Active Incidents" value={activeIncidents} alert={activeAlert} />
        <div className="h-10 w-px bg-white/10" />
        <Metric label="Avg Response" value={avgResponseTime} unit="m" alert={responseAlert} />
        <div className="h-10 w-px bg-white/10" />
        <Metric label="Pending Triage" value={pendingTriage} alert={pendingAlert} />
      </div>
      <button
        onClick={toggleStatusBarExpanded}
        className="w-full py-1 text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      >
        {expanded ? '▲ Less' : '▼ More'}
      </button>
      {expanded && (
        <div className="flex justify-around border-t border-white/10 px-4 py-2 text-sm text-[var(--color-text-secondary)]">
          <span>
            Resolved Today:{' '}
            <strong className="text-[var(--color-text-primary)]">{resolvedToday}</strong>
          </span>
          <span>
            Muni Issues:{' '}
            <strong className="text-[var(--color-text-primary)]">
              {municipalitiesWithIssues.withIssues}/{municipalitiesWithIssues.total}
            </strong>
          </span>
          <span>
            Surge:{' '}
            <strong className="text-[var(--color-text-primary)]">
              {isSurge ? 'Active' : 'Idle'}
            </strong>
          </span>
        </div>
      )}
    </div>
  )
}
