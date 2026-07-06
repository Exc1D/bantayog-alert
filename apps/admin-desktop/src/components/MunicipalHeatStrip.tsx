import type { MunicipalPerformance } from '../types'

// Same uncovered rule as getUncoveredMunicipalityCount: active incidents, zero responders.
function isUncovered(m: MunicipalPerformance): boolean {
  const responders = m.activeResponders ?? 0
  return m.activeIncidents > 0 && responders === 0
}

function cellColor(m: MunicipalPerformance): string {
  if (isUncovered(m)) return 'var(--color-danger)'
  if (m.activeIncidents > 0) return 'var(--color-warning)'
  return 'var(--color-success)'
}

export function MunicipalHeatStrip({
  data,
  onSelect,
}: {
  data: MunicipalPerformance[]
  onSelect: (municipality: string) => void
}) {
  if (data.length === 0) return null

  return (
    <section
      aria-label="Municipality status"
      className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-3"
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Municipal status
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {data.map((m) => {
          const responders = m.activeResponders ?? 0
          const uncovered = isUncovered(m)
          return (
            <button
              key={m.municipality}
              type="button"
              onClick={() => {
                onSelect(m.municipality)
              }}
              title={`${m.municipality}: ${String(m.activeIncidents)} active, ${String(responders)} responders${uncovered ? ' — uncovered' : ''}`}
              className="flex min-w-[92px] flex-col gap-1 rounded border border-white/10 px-2 py-1.5 text-left hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: cellColor(m) }}
                  aria-hidden="true"
                />
                <span className="truncate text-[11px] font-medium text-[var(--color-text-primary)]">
                  {m.municipality}
                </span>
              </span>
              <span className="pl-3.5 text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                {`${String(m.activeIncidents)} active${uncovered ? ' · uncovered' : ''}`}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
