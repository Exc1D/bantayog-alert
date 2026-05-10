import { useEffect, useState } from 'react'

interface Props {
  lastUpdatedAt: number
}

function formatElapsed(seconds: number): string {
  if (seconds < 5) return 'Updated just now'
  if (seconds < 60) return `Updated ${String(seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    if (minutes < 5) return `Updated ${String(minutes)}m ago`
    return `Updated ${String(minutes)}m ago — data may be stale`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Updated ${String(hours)}h ago — data may be stale`
  return 'Updated >1d ago — data may be stale'
}

function statusColor(seconds: number): string {
  if (seconds < 60) return 'bg-green-500'
  if (seconds < 300) return 'bg-amber-500'
  return 'bg-red-500'
}

export function DataFreshnessLabel({ lastUpdatedAt }: Props) {
  const [seconds, setSeconds] = useState(() => {
    const elapsed = (Date.now() - lastUpdatedAt) / 1000
    return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed)) : 0
  })

  useEffect(() => {
    const update = () => {
      const elapsed = (Date.now() - lastUpdatedAt) / 1000
      const safe = Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed)) : 0
      setSeconds(safe)
    }
    update()
    const id = setInterval(update, 10_000)
    return () => {
      clearInterval(id)
    }
  }, [lastUpdatedAt])

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${statusColor(seconds)}`}
        aria-hidden="true"
        data-testid="freshness-dot"
      />
      <span className="text-xs text-[var(--color-text-secondary)]">{formatElapsed(seconds)}</span>
    </div>
  )
}
