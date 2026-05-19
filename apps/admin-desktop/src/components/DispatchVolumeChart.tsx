import { useMemo } from 'react'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'

const TIME_AXIS_LABELS = ['00:00', '06:00', '12:00', '18:00', 'Now'] as const

interface Props {
  rows: DispatchLifecycleRow[]
  isLoading?: boolean
}

export function DispatchVolumeChart({ rows, isLoading }: Props) {
  // eslint-disable-next-line react-hooks/purity -- intentionally impure: reads current time on each render for a real-time dashboard
  const now = Date.now()
  const { counts, maxCount, hasData } = useMemo(() => {
    const c: number[] = new Array(24).fill(0)
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    for (const row of rows) {
      const raw = row.dispatchedAt
      if (typeof raw !== 'number') continue
      if (!Number.isFinite(raw) || raw > now || raw < 0) {
        continue
      }
      const date = new Date(raw)
      if (Number.isNaN(date.getTime())) continue
      if (raw < oneDayAgo) continue
      const hour = date.getHours()
      c[hour] = (c[hour] ?? 0) + 1
    }
    return {
      counts: c,
      maxCount: Math.max(...c, 1),
      hasData: c.some((x) => x > 0),
    }
  }, [rows, now])

  return (
    <section aria-label="Dispatch volume last 24 hours">
      <div className="mb-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        Dispatch Volume — 24h
      </div>
      {isLoading ? (
        <div
          className="rounded border border-white/10 bg-white/5 p-4"
          data-testid="dispatch-volume-skeleton"
        >
          <div className="flex items-end gap-1 h-20">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-white/10 animate-pulse rounded-t"
                style={{ height: '100%' }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            {TIME_AXIS_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      ) : !hasData ? (
        <div className="rounded border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-gray-400">
          No dispatches in last 24h
        </div>
      ) : (
        <div className="rounded border border-white/10 bg-white/5 p-4">
          <div className="flex items-end gap-1 h-20">
            {counts.map((count, hour) => (
              <div
                key={hour}
                className="flex-1 bg-[var(--color-info)]/60 rounded-t"
                style={{
                  height: `${String((count / maxCount) * 100)}%`,
                  minHeight: count > 0 ? '4px' : '0px',
                }}
                role="img"
                aria-label={`${String(count)} dispatches at ${String(hour).padStart(2, '0')}:00`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            {TIME_AXIS_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
