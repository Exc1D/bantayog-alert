import { Link } from 'react-router-dom'
import type { DashboardMode } from '../../utils/dashboard-mode'
import { getFreshnessText } from './format-utils'

interface StatusLeftProps {
  mode: DashboardMode
  affectedMunicipalities: string[]
  lastDataUpdateAt: number
  modeShouldPulse: boolean
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

export function StatusLeft({
  mode,
  affectedMunicipalities,
  lastDataUpdateAt,
  modeShouldPulse,
}: StatusLeftProps) {
  const freshnessText = getFreshnessText(lastDataUpdateAt)

  return (
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
  )
}
