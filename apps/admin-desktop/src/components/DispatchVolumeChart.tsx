import { useMemo } from 'react'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'

const BUCKET_COUNT = 24
const HOUR_MS = 60 * 60 * 1000
const AXIS_BUCKETS = [0, 6, 12, 18] as const

interface Props {
  rows: DispatchLifecycleRow[]
  isLoading?: boolean
}

function getHourStart(timestamp: number): number {
  const date = new Date(timestamp)
  date.setMinutes(0, 0, 0)
  return date.getTime()
}

function formatHour(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function DispatchVolumeChart({ rows, isLoading }: Props) {
  const { buckets, maxCount, hasData, axisLabels } = useMemo(() => {
    const counts: number[] = new Array(BUCKET_COUNT).fill(0)
    // eslint-disable-next-line react-hooks/purity -- chart buckets intentionally follow the current hour
    const now = Date.now()
    const windowStart = getHourStart(now) - (BUCKET_COUNT - 1) * HOUR_MS

    for (const row of rows) {
      const raw = row.dispatchedAt
      if (
        typeof raw !== 'number' ||
        !Number.isFinite(raw) ||
        raw > now ||
        raw < windowStart
      ) {
        continue
      }

      const bucketIndex = Math.floor((raw - windowStart) / HOUR_MS)
      if (bucketIndex < 0 || bucketIndex >= BUCKET_COUNT) continue
      counts[bucketIndex] = (counts[bucketIndex] ?? 0) + 1
    }

    return {
      buckets: counts.map((count, index) => ({
        count,
        label: formatHour(windowStart + index * HOUR_MS),
      })),
      maxCount: Math.max(...counts, 1),
      hasData: counts.some((count) => count > 0),
      axisLabels: [
        ...AXIS_BUCKETS.map((index) => formatHour(windowStart + index * HOUR_MS)),
        'Now',
      ],
    }
  }, [rows])

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
          <div className="flex h-20 items-end gap-1">
            {Array.from({ length: BUCKET_COUNT }).map((_, index) => (
              <div key={index} className="h-full flex-1 animate-pulse rounded-t bg-white/10" />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            {axisLabels.map((label) => (
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
          <div className="flex h-20 items-end gap-1">
            {buckets.map(({ count, label }) => (
              <div
                key={label}
                className="flex-1 rounded-t bg-[var(--color-info)]/60"
                style={{
                  height: `${String((count / maxCount) * 100)}%`,
                  minHeight: count > 0 ? '4px' : '0px',
                }}
                role="img"
                aria-label={`${String(count)} dispatch${count === 1 ? '' : 'es'} at ${label}`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            {axisLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
