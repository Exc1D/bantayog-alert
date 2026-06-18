import { useCommandCenterStore } from '../../stores/commandCenterStore'
import type { DashboardMode } from '../../utils/dashboard-mode'
import { StatusLeft } from './StatusLeft'
import { StatusCenter } from './StatusCenter'
import { StatusRight } from './StatusRight'
import { StatusExpanded } from './StatusExpanded'

interface Props {
  activeIncidents: number
  avgResponseTime: number // minutes
  avgAcceptSeconds: number | null
  fcmSuccessRate: number | null
  pendingTriage: number
  resolvedToday?: number
  muniIssues?: { resolved: number; total: number }
  mode: DashboardMode
  affectedMunicipalities: string[]
  stalledDispatchCount: number
  totalResponders: number
  uncoveredMunicipalities: number
  lastDataUpdateAt: number
  metricsError?: string | null
}

export function StatusBar({
  activeIncidents,
  avgResponseTime,
  avgAcceptSeconds,
  fcmSuccessRate,
  pendingTriage,
  resolvedToday,
  muniIssues,
  mode,
  affectedMunicipalities,
  stalledDispatchCount,
  totalResponders,
  uncoveredMunicipalities,
  lastDataUpdateAt,
  metricsError,
}: Props) {
  const { statusBarExpandedOverride, toggleStatusBarExpanded } = useCommandCenterStore()
  const isSurge = pendingTriage >= 20 || activeIncidents >= 50
  const expanded = statusBarExpandedOverride ?? !isSurge
  const modeShouldPulse = mode === 'degraded' || mode === 'surge'

  return (
    <div
      data-testid="statusbar-root"
      className={`sticky top-0 z-50 border-b bg-[var(--color-surface)] ${
        isSurge
          ? 'motion-safe:animate-pulse border-[var(--color-severity-medium)]'
          : 'border-[var(--color-surface)]'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <StatusLeft
          mode={mode}
          affectedMunicipalities={affectedMunicipalities}
          lastDataUpdateAt={lastDataUpdateAt}
          modeShouldPulse={modeShouldPulse}
        />

        <StatusCenter
          activeIncidents={activeIncidents}
          avgResponseTime={avgResponseTime}
          pendingTriage={pendingTriage}
        />

        <StatusRight
          stalledDispatchCount={stalledDispatchCount}
          totalResponders={totalResponders}
          uncoveredMunicipalities={uncoveredMunicipalities}
        />
      </div>

      {metricsError != null && (
        <div className="px-4 pb-1">
          <span
            role="status"
            aria-label="Metrics unavailable"
            className="text-xs text-[var(--color-text-muted)]"
          >
            Metrics unavailable
          </span>
        </div>
      )}

      <button
        onClick={toggleStatusBarExpanded}
        className="w-full py-1 text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      >
        {expanded ? '▲ Less' : '▼ More'}
      </button>

      {expanded && (
        <StatusExpanded
          resolvedToday={resolvedToday}
          muniIssues={muniIssues}
          stalledDispatchCount={stalledDispatchCount}
          fcmSuccessRate={fcmSuccessRate}
          avgAcceptSeconds={avgAcceptSeconds}
          isSurge={isSurge}
        />
      )}
    </div>
  )
}
