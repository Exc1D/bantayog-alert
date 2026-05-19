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

export function DispatchTimeline({ events }: Props) {
  if (events.length === 0) {
    return <p>No events recorded</p>
  }

  const sorted = [...events].sort((a, b) => a.at - b.at)

  return (
    <ul>
      {sorted.map((event) => (
        <li key={event.id}>
          <span>{LABEL_MAP[event.type] ?? event.type}</span>
          <span>{formatTimeHHMMSS(event.at)}</span>
        </li>
      ))}
    </ul>
  )
}
