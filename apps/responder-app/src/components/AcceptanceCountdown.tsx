import { useEffect, useState } from 'react'

interface Props {
  deadlineMs: number
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired'
  const totalSecs = Math.ceil(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${String(mins)}:${String(secs).padStart(2, '0')}`
}

export function AcceptanceCountdown({ deadlineMs }: Props) {
  const [remaining, setRemaining] = useState(() => deadlineMs - Date.now())

  useEffect(() => {
    if (remaining <= 0) return
    const id = setInterval(() => {
      setRemaining(deadlineMs - Date.now())
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [deadlineMs, remaining])

  const isExpired = remaining <= 0
  const isUrgent = remaining > 0 && remaining < 60_000

  const color = isExpired ? '#6b7280' : isUrgent ? 'var(--color-danger)' : 'var(--color-warning)'

  return (
    <span
      style={{
        color,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
      aria-live="polite"
      aria-label={
        isExpired ? 'Acceptance window expired' : `Accept by ${formatRemaining(remaining)}`
      }
    >
      {formatRemaining(remaining)}
    </span>
  )
}
