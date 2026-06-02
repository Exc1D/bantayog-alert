import { useState } from 'react'
import type { DispatchEvent } from '../hooks/useDispatchLifecycle'

interface Props {
  events: DispatchEvent[]
}

const LABEL_MAP: Record<string, string> = {
  notification_attempted: 'FCM Sent',
  notification_delivered: 'Responder Notified',
  deadline_exceeded: 'Deadline Passed',
  escalation_attempted: 'Re-assigned',
  lease_stolen: 'Lease Override',
}

function formatTimeHHMMSS(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const MAX_EVENTS = 20

export function DispatchTimeline({ events }: Props) {
  const [showAll, setShowAll] = useState(false)

  if (events.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No events recorded</p>
  }

  const sorted = [...events].sort((a, b) => a.at - b.at)
  const visible = showAll ? sorted : sorted.slice(0, MAX_EVENTS)
  const hasMore = sorted.length > MAX_EVENTS

  return (
    <div>
      <ul className="space-y-1">
        {visible.map((event) => (
          <li key={event.id} className="flex items-center gap-2 text-sm">
            <span className="font-medium text-[var(--color-text-primary)]">
              {LABEL_MAP[event.type] ?? event.type}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatTimeHHMMSS(event.at)}
            </span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => {
            setShowAll((prev) => !prev)
          }}
          className="mt-2 text-xs text-[var(--color-carto-blue)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-carto-blue)]"
        >
          {showAll ? 'Show less' : `Show ${String(sorted.length - MAX_EVENTS)} more`}
        </button>
      )}
    </div>
  )
}
