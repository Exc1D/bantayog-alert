import type { ResponderFleetMember } from '../hooks/useResponderFleet'

interface Props {
  responders: ResponderFleetMember[]
}

const STATUS_DOT_COLOR: Record<ResponderFleetMember['onlineStatus'], string> = {
  online: 'bg-green-500',
  away: 'bg-amber-500',
  offline: 'bg-gray-500',
}

export function ResponderAvailabilityPanel({ responders }: Props) {
  if (responders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)]">
        <p className="text-sm">No responders online</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
        Responders ({responders.length})
      </h3>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {responders.map((responder) => (
          <li
            key={responder.uid}
            className="flex items-center gap-2 rounded-md bg-[var(--color-surface-elevated)] px-3 py-2"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_COLOR[responder.onlineStatus]}`}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {responder.displayName}
            </span>
            <span className="ml-auto text-xs text-[var(--color-text-muted)] capitalize">
              {responder.onlineStatus}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
