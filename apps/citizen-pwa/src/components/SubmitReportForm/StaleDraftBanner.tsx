const STALE_THRESHOLD_MS = 12 * 3600 * 1000

interface StaleDraftBannerProps {
  updatedAt: number
  now: number
}

export function StaleDraftBanner({ updatedAt, now }: StaleDraftBannerProps) {
  const age = now - updatedAt
  if (age <= STALE_THRESHOLD_MS) {
    return null
  }

  const dateStr = new Date(updatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      role="alert"
      style={{
        padding: 'var(--spacing-md) var(--spacing-lg)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--color-queued-bg)',
        color: 'var(--color-queued-fg)',
        fontWeight: 500,
        marginBottom: 'var(--spacing-md)',
        border: '1px solid var(--color-queued-fg)',
      }}
    >
      This draft is from {dateStr}. Location and details may be outdated.
    </div>
  )
}
