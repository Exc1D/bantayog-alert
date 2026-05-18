import { useEffect, useState } from 'react'

interface Props {
  lastUpdatedAt: number
}

export function LiveIndicator({ lastUpdatedAt }: Props) {
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    const update = () => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedAt) / 1000))
    }
    update()
    const id = setInterval(update, 1000)
    return () => {
      clearInterval(id)
    }
  }, [lastUpdatedAt])

  const isStale = secondsAgo > 60
  const isVeryStale = secondsAgo > 300
  const dotColor = isVeryStale
    ? 'var(--color-danger)'
    : isStale
      ? 'var(--color-warning)'
      : 'var(--color-success)'
  const label = isVeryStale
    ? 'Data may be stale'
    : isStale
      ? 'Updated >1m ago'
      : `Updated ${String(secondsAgo)}s ago`

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: dotColor }}
        role="status"
        aria-label={label}
      />
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
    </div>
  )
}
