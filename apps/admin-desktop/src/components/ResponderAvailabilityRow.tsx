import { ChevronDown } from 'lucide-react'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'

const STATUS_DOT_COLOR: Record<ResponderFleetMember['onlineStatus'], string> = {
  online: 'bg-green-500',
  away: 'bg-amber-500',
  offline: 'bg-gray-500',
}

const STATUS_CHIP_COLOR: Record<ResponderFleetMember['onlineStatus'], string> = {
  online: 'border-green-500/20 bg-green-500/10 text-green-300',
  away: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  offline: 'border-white/10 bg-white/5 text-[var(--color-text-muted)]',
}

const STATUS_ROW_OPACITY: Record<ResponderFleetMember['onlineStatus'], string> = {
  online: '',
  away: '',
  offline: 'opacity-60',
}

function formatLastActivity(lastActivityAt: number): string {
  const minutes = Math.floor(Math.max(0, Date.now() - lastActivityAt) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function JurisdictionChips({
  agencyId,
  municipalityId,
}: {
  agencyId: string | undefined
  municipalityId: string | undefined
}) {
  const jurisdictions = [agencyId, municipalityId].filter(
    (value): value is string => value !== undefined,
  )

  if (jurisdictions.length === 0) {
    return (
      <span className="text-[11px] text-[var(--color-text-muted)]">Jurisdiction not assigned</span>
    )
  }

  return jurisdictions.map((jurisdiction) => (
    <span
      key={jurisdiction}
      className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]"
    >
      {jurisdiction}
    </span>
  ))
}

export interface ResponderRowActions {
  onSetOffDuty?: (uid: string) => void
  onSuspend?: (uid: string) => void
  onRevoke?: (uid: string) => void
}

function ResponderDetails({
  detailsId,
  responder,
  actions,
}: {
  detailsId: string
  responder: ResponderFleetMember
  actions?: ResponderRowActions
}) {
  const hasActions = Boolean(
    actions && (actions.onSetOffDuty ?? actions.onSuspend ?? actions.onRevoke),
  )
  return (
    <div id={detailsId} className="border-t border-white/10 px-3 py-2">
      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-[var(--color-text-muted)]">Availability</dt>
          <dd className="mt-0.5 font-medium capitalize text-[var(--color-text-primary)]">
            {responder.availabilityStatus.replaceAll('_', ' ')}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-[var(--color-text-muted)]">Last activity</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-[var(--color-text-primary)]">
            {formatLastActivity(responder.lastActivityAt)}
          </dd>
        </div>
      </dl>
      {hasActions && (
        <div className="mt-2 flex flex-wrap gap-2 border-t border-white/5 pt-2">
          {actions?.onSetOffDuty && (
            <button
              type="button"
              onClick={() => {
                actions.onSetOffDuty?.(responder.uid)
              }}
              className="rounded border border-white/15 px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]/50"
            >
              Set off-duty
            </button>
          )}
          {actions?.onSuspend && (
            <button
              type="button"
              onClick={() => {
                actions.onSuspend?.(responder.uid)
              }}
              className="rounded border border-[var(--color-warning)]/40 px-2 py-1 text-[11px] font-medium text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-warning)]/50"
            >
              Suspend
            </button>
          )}
          {actions?.onRevoke && (
            <button
              type="button"
              onClick={() => {
                actions.onRevoke?.(responder.uid)
              }}
              className="rounded border border-[var(--color-danger)]/40 px-2 py-1 text-[11px] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]/50"
            >
              Revoke
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function ResponderAvailabilityRow({
  expanded,
  onToggle,
  responder,
  actions,
}: {
  expanded: boolean
  onToggle: () => void
  responder: ResponderFleetMember
  actions?: ResponderRowActions
}) {
  const detailsId = `responder-details-${responder.uid}`
  const action = expanded ? 'Hide' : 'View'
  const chevronRotation = expanded ? 'rotate-180' : ''

  return (
    <li
      className={`rounded-md border border-white/10 bg-[var(--color-surface-elevated)] transition-opacity ${STATUS_ROW_OPACITY[responder.onlineStatus]}`}
    >
      <button
        type="button"
        aria-controls={detailsId}
        aria-expanded={expanded}
        aria-label={`${action} ${responder.displayName} responder details`}
        title={`${action} responder operational details`}
        className="w-full rounded-md px-3 py-2 text-left hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-info)]"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_COLOR[responder.onlineStatus]}`}
            title={`Presence: ${responder.onlineStatus}`}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
            {responder.displayName}
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_CHIP_COLOR[responder.onlineStatus]}`}
          >
            {responder.onlineStatus}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${chevronRotation}`}
            aria-hidden="true"
          />
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5 pl-4">
          <JurisdictionChips
            agencyId={responder.agencyId}
            municipalityId={responder.municipalityId}
          />
        </span>
      </button>
      {expanded && (
        <ResponderDetails
          detailsId={detailsId}
          responder={responder}
          {...(actions ? { actions } : {})}
        />
      )}
    </li>
  )
}
