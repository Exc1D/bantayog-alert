import { Link } from 'react-router-dom'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import type { DashboardMode } from '../utils/dashboard-mode'

interface Props {
  activeIncidents: number
  avgResponseTime: number // minutes
  avgAcceptSeconds: number | null
  fcmSuccessRate: number
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

type AlertLevel = 'none' | 'amber' | 'red'

function alertColorClass(alert: AlertLevel): string {
  if (alert === 'red') return 'text-[var(--color-danger)]'
  if (alert === 'amber') return 'text-[var(--color-warning)]'
  return 'text-[var(--color-text-primary)]'
}

function alertDotColor(alert: AlertLevel): string {
  if (alert === 'red') return 'var(--color-danger)'
  if (alert === 'amber') return 'var(--color-warning)'
  return 'transparent'
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m)}m ${String(s)}s`
}

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
        {unit && (
          <span className="text-xs font-normal text-[var(--color-text-muted)]">{unit}</span>
        )}
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
}: Props) {
  const { statusBarExpandedOverride, toggleStatusBarExpanded } = useCommandCenterStore()
  const isSurge = pendingTriage >= 20 || activeIncidents >= 50
  const expanded = statusBarExpandedOverride ?? !isSurge

  const activeAlert: AlertLevel = activeIncidents > 75 ? 'red' : activeIncidents > 50 ? 'amber' : 'none'
  const responseAlert: AlertLevel = avgResponseTime > 20 ? 'red' : avgResponseTime > 15 ? 'amber' : 'none'
  const pendingAlert: AlertLevel = pendingTriage > 10 ? 'red' : pendingTriage > 5 ? 'amber' : 'none'

  const fcmPercent = Math.round(fcmSuccessRate * 100)
  const isFcmHigh = fcmSuccessRate >= 0.9

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
              boxShadow: modeShouldPulse ? `0 0 12px ${MODE_COLORS[mode]}30` : undefined,
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
                  className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--color-carto-blue)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-carto-blue)]/50"
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

        {/* Center: Situation strip */}
        <div className="flex flex-1 items-center justify-center gap-1 text-sm text-[var(--color-text-secondary)]">
          <SituationValue value={activeIncidents} alert={activeAlert} />
          <span className="text-xs text-[var(--color-text-muted)]">active</span>
          <span className="text-xs text-[var(--color-text-muted)]">·</span>
          <SituationValue value={avgResponseTime} unit="m" alert={responseAlert} />
          <span className="text-xs text-[var(--color-text-muted)]">avg response</span>
          <span className="text-xs text-[var(--color-text-muted)]">·</span>
          <SituationValue value={pendingTriage} alert={pendingAlert} />
          <span className="text-xs text-[var(--color-text-muted)]">pending</span>
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
            Resolved:{" "}
            <strong
              data-testid="statusbar-resolved-today"
              className="text-[var(--color-text-primary)]"
            >
              {resolvedToday === undefined ? "—" : String(resolvedToday)}
            </strong>
          </span>
          <span>
            Muni Issues:{" "}
            <strong
              data-testid="statusbar-muni-issues"
              className="text-[var(--color-text-primary)]"
            >
              {muniIssues ? `${String(muniIssues.resolved)}/${String(muniIssues.total)}` : "—"}
            </strong>
          </span>
          <span>
            Stalled:{" "}
            <strong
              data-testid="statusbar-stalled"
              className={
                stalledDispatchCount > 0
                  ? "text-[var(--color-danger)]"
                  : "text-[var(--color-text-primary)]"
              }
            >
              {String(stalledDispatchCount)}
            </strong>
          </span>
          <span>
            Push Rate:{" "}
            <strong
              data-testid="statusbar-fcm-rate"
              className={
                isFcmHigh
                  ? "text-[var(--color-success)]"
                  : "text-[var(--color-warning)]"
              }
            >
              {fcmPercent}%
            </strong>
          </span>
          <span>
            Avg Response:{" "}
            <strong
              data-testid="statusbar-avg-accept"
              className="text-[var(--color-text-primary)]"
            >
              {avgAcceptSeconds !== null ? formatSeconds(avgAcceptSeconds) : "—"}
            </strong>
          </span>
          <span>
            Surge:{" "}
            <strong className="text-[var(--color-text-primary)]">
              {isSurge ? "Active" : "Idle"}
            </strong>
          </span>
        </div>
      )}
    </div>
  )
}
