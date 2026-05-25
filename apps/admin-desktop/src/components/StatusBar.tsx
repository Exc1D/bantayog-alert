import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import type { DashboardMode } from '../utils/dashboard-mode'

interface Props {
  activeIncidents: number
  avgResponseTime: number // minutes
  pendingTriage: number
  resolvedToday?: number
  muniIssues?: { resolved: number; total: number }
  mode: DashboardMode
  affectedMunicipalities: string[]
  stalledDispatchCount: number
  totalResponders: number
  uncoveredMunicipalities: number
  lastDataUpdateAt: number
}

const MODE_COLORS: Record<DashboardMode, string> = {
  calm: 'var(--color-success)',
  active: 'var(--color-info)',
  degraded: 'var(--color-warning)',
  surge: 'var(--color-danger)',
} as const

const MODE_LABELS: Record<DashboardMode, string> = {
  calm: 'CALM',
  active: 'ACTIVE',
  degraded: 'DEGRADED',
  surge: 'SURGE',
} as const

function getFreshnessText(lastDataUpdateAt: number): string {
  const secondsAgo = Math.floor((Date.now() - lastDataUpdateAt) / 1000)
  if (secondsAgo < 60) {
    return `live ${String(secondsAgo)}s ago`
  }
  const minutesAgo = Math.floor(secondsAgo / 60)
  if (minutesAgo <= 5) {
    return `updated ${String(minutesAgo)}m ago`
  }
  return `stale ${String(minutesAgo)}m ago`
}

type OpLabel = 'Normal' | 'Watch' | 'Degraded'

function activeLabel(active: number): OpLabel {
  if (active <= 10) return 'Normal'
  if (active <= 20) return 'Watch'
  return 'Degraded'
}

function responseLabel(minutes: number): OpLabel {
  if (minutes <= 5) return 'Normal'
  if (minutes <= 10) return 'Watch'
  return 'Degraded'
}

function triageLabel(pending: number): OpLabel {
  if (pending <= 3) return 'Normal'
  if (pending <= 7) return 'Watch'
  return 'Degraded'
}

function Metric({
  label,
  value,
  unit,
  alert,
  opLabel,
}: {
  label: string
  value: number
  unit?: string
  alert: 'none' | 'amber' | 'red'
  opLabel?: OpLabel
}) {
  const alertColor =
    alert === 'red'
      ? 'var(--color-danger)'
      : alert === 'amber'
        ? 'var(--color-warning)'
        : 'transparent'
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className="mt-1 font-mono text-2xl font-medium leading-none text-[var(--color-text-primary)]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
        {unit && <span className="ml-1 text-lg">{unit}</span>}
      </span>
      {alert !== 'none' && (
        <span className="mt-1 h-1 w-8 rounded-full" style={{ backgroundColor: alertColor }} />
      )}
      {opLabel && (
        <span className="mt-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {opLabel}
        </span>
      )}
    </div>
  )
}

export function StatusBar({
  activeIncidents,
  avgResponseTime,
  pendingTriage,
  resolvedToday,
  muniIssues,
  mode,
  affectedMunicipalities,
  stalledDispatchCount,
  totalResponders,
  uncoveredMunicipalities,
  lastDataUpdateAt,
}: Props) {
  const { statusBarExpandedOverride, toggleStatusBarExpanded } = useCommandCenterStore()
  const isSurge = pendingTriage >= 20 || activeIncidents >= 50
  const expanded = statusBarExpandedOverride ?? !isSurge

  const activeAlert = activeIncidents > 75 ? 'red' : activeIncidents > 50 ? 'amber' : 'none'
  const responseAlert = avgResponseTime > 20 ? 'red' : avgResponseTime > 15 ? 'amber' : 'none'
  const pendingAlert = pendingTriage > 10 ? 'red' : pendingTriage > 5 ? 'amber' : 'none'

  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1)
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [])

  const modeShouldPulse = mode === 'degraded' || mode === 'surge'
  const freshnessText = getFreshnessText(lastDataUpdateAt)

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
        {/* Left: Mode badge + municipalities + freshness */}
        <div className="flex flex-1 items-center gap-4">
          <span
            role="status"
            aria-live="polite"
            data-testid="mode-badge"
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
              modeShouldPulse ? 'motion-safe:animate-pulse' : ''
            }`}
            style={{
              backgroundColor: `${MODE_COLORS[mode]}20`,
              color: MODE_COLORS[mode],
              border: `1px solid ${MODE_COLORS[mode]}40`,
            }}
          >
            {MODE_LABELS[mode]}
          </span>

          {mode !== 'calm' && affectedMunicipalities.length > 0 && (
            <div className="flex items-center gap-2" data-testid="municipality-chips">
              {affectedMunicipalities.map((muni) => (
                <Link
                  key={muni}
                  to={`/map?municipality=${encodeURIComponent(muni)}`}
                  className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  {muni}
                </Link>
              ))}
            </div>
          )}

          {mode === 'calm' && (
            <span className="text-xs text-[var(--color-text-muted)]" data-testid="all-clear">
              All clear
            </span>
          )}

          <span
            className="text-xs text-[var(--color-text-muted)]"
            data-testid="data-freshness"
            title={new Date(lastDataUpdateAt).toLocaleString()}
          >
            {freshnessText}
          </span>
        </div>

        {/* Center: Metrics */}
        <div className="flex flex-1 items-center justify-around">
          <Metric
            label="Active Incidents"
            value={activeIncidents}
            alert={activeAlert}
            opLabel={activeLabel(activeIncidents)}
          />
          <div className="h-10 w-px bg-white/10" />
          <Metric
            label="Avg Response"
            value={avgResponseTime}
            unit="m"
            alert={responseAlert}
            opLabel={responseLabel(avgResponseTime)}
          />
          <div className="h-10 w-px bg-white/10" />
          <Metric
            label="Pending Triage"
            value={pendingTriage}
            alert={pendingAlert}
            opLabel={triageLabel(pendingTriage)}
          />
        </div>

        {/* Right: Blocking + coverage */}
        <div className="flex flex-1 items-center justify-end gap-6">
          {stalledDispatchCount > 0 && (
            <div className="flex flex-col items-end" data-testid="blocking-response">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                Blocking
              </span>
              <span className="mt-1 text-sm font-semibold text-[var(--color-danger)]">
                {stalledDispatchCount} stalled dispatch{stalledDispatchCount === 1 ? '' : 'es'}
              </span>
            </div>
          )}
          <div className="flex flex-col items-end" data-testid="responder-coverage">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Coverage
            </span>
            <span className="mt-1 text-sm text-[var(--color-text-primary)]">
              {totalResponders} available / {uncoveredMunicipalities} uncovered
            </span>
          </div>
        </div>
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
            <strong
              data-testid="statusbar-resolved-today"
              className="text-[var(--color-text-primary)]"
            >
              {resolvedToday === undefined ? '—' : String(resolvedToday)}
            </strong>
          </span>
          <span>
            Muni Issues:{' '}
            <strong
              data-testid="statusbar-muni-issues"
              className="text-[var(--color-text-primary)]"
            >
              {muniIssues ? `${String(muniIssues.resolved)}/${String(muniIssues.total)}` : '—'}
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
