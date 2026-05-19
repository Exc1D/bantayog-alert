import { useMemo } from 'react'
import type { DispatchLifecycleRow, DispatchEvent } from '../hooks/useDispatchLifecycle'

const EVENT_LABELS: Record<string, string> = {
  notification_attempted: 'FCM Sent',
  notification_delivered: 'Responder Notified',
  deadline_exceeded: 'Deadline Passed',
  escalation_attempted: 'Re-assigned',
  lease_stolen: 'Lease Override',
}

interface Props {
  rows: DispatchLifecycleRow[]
  maxEvents?: number
}

function getEventIndicator(type: string): { color: string; shape: string } {
  switch (type) {
    case 'notification_attempted':
      return { color: 'bg-[var(--color-info)]', shape: 'rounded-full' }
    case 'notification_delivered':
      return { color: 'bg-[var(--color-success)]', shape: 'rounded-full' }
    case 'escalation_attempted':
      return { color: 'bg-[var(--color-warning)]', shape: 'clip-triangle' }
    case 'deadline_exceeded':
      return { color: 'bg-[var(--color-danger)]', shape: 'clip-diamond' }
    case 'lease_stolen':
      return { color: 'bg-purple-500', shape: 'rounded-full' }
    default:
      return { color: 'bg-gray-500', shape: 'rounded-full' }
  }
}

function formatRelativeTime(at: number): string {
  const diff = Date.now() - at
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${String(Math.floor(diff / 60000))}m ago`
  if (diff < 86400000) return `${String(Math.floor(diff / 3600000))}h ago`
  return `${String(Math.floor(diff / 86400000))}d ago`
}

export function RecentEventsFeed({ rows, maxEvents = 20 }: Props) {
  const events = useMemo(() => {
    const all: DispatchEvent[] = []
    for (const row of rows) {
      for (const event of row.timeline) {
        all.push(event)
      }
    }
    return all.sort((a, b) => b.at - a.at).slice(0, maxEvents)
  }, [rows, maxEvents])

  return (
    <section aria-label="Recent dispatch events">
      <div className="mb-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        Recent Events
      </div>
      <div className="rounded border border-white/10 bg-white/5 p-4">
        {events.length === 0 ? (
          <div className="py-4 text-center text-sm text-gray-400">No events recorded</div>
        ) : (
          <ul className="space-y-2" role="list">
            {/* eslint-disable-line jsx-a11y/no-redundant-roles */}
            {events.map((event) => {
              const label = EVENT_LABELS[event.type] ?? event.type
              const { color, shape } = getEventIndicator(event.type)
              const relativeTime = formatRelativeTime(event.at)
              return (
                <li
                  key={event.id}
                  className="flex items-center gap-3"
                  aria-label={`${label} — ${relativeTime}`}
                >
                  <div className={`h-2 w-2 flex-shrink-0 ${color} ${shape}`} aria-hidden="true" />
                  <span className="flex-1 text-sm text-[var(--color-text-secondary)]">{label}</span>
                  <span className="text-xs text-gray-500 font-mono">{relativeTime}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
