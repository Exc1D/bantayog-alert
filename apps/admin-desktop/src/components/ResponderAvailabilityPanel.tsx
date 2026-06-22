import { useState } from 'react'
import { ChevronDown, UserPlus, Users } from 'lucide-react'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'

interface Props {
  responders: ResponderFleetMember[]
  onCreateResponder?: (input: {
    displayName: string
    phone: string
    agencyId: string
    municipalityId?: string
    specializations?: string[]
  }) => Promise<void>
  creatingResponder?: boolean
}

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

function formatLastActivity(lastActivityAt: number): string {
  const minutes = Math.floor(Math.max(0, Date.now() - lastActivityAt) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function CreateResponderForm({
  onCreateResponder,
  creatingResponder,
}: {
  onCreateResponder: NonNullable<Props['onCreateResponder']>
  creatingResponder: boolean
}) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [agencyId, setAgencyId] = useState('')
  const [municipalityId, setMunicipalityId] = useState('')
  const [specializations, setSpecializations] = useState('')

  return (
    <div className="mb-4 rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-3">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
        }}
        className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-[var(--color-text-primary)]"
      >
        <span className="inline-flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[var(--color-info)]" aria-hidden="true" />
          Create responder account
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{open ? 'Close' : 'Open'}</span>
      </button>
      {open && (
        <form
          className="mt-3 grid gap-2 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmedDisplayName = displayName.trim()
            const trimmedPhone = phone.trim()
            const trimmedAgencyId = agencyId.trim()
            if (!trimmedDisplayName || !trimmedPhone || !trimmedAgencyId) return
            const trimmedMunicipality = municipalityId.trim()
            const specializationList = specializations
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
            void (async () => {
              try {
                await onCreateResponder({
                  displayName: trimmedDisplayName,
                  phone: trimmedPhone,
                  agencyId: trimmedAgencyId,
                  ...(trimmedMunicipality ? { municipalityId: trimmedMunicipality } : {}),
                  ...(specializationList.length > 0 ? { specializations: specializationList } : {}),
                })
                setDisplayName('')
                setPhone('')
                setAgencyId('')
                setMunicipalityId('')
                setSpecializations('')
                setOpen(false)
              } catch {
                // leave form open for retry
              }
            })()
          }}
        >
          <input
            aria-label="Responder display name"
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value)
            }}
            className="rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            placeholder="Display name"
            required
          />
          <input
            aria-label="Responder phone"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value)
            }}
            className="rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            placeholder="+639171234567"
            required
          />
          <input
            aria-label="Responder agency"
            value={agencyId}
            onChange={(event) => {
              setAgencyId(event.target.value)
            }}
            className="rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            placeholder="Agency ID"
            required
          />
          <input
            aria-label="Responder municipality"
            value={municipalityId}
            onChange={(event) => {
              setMunicipalityId(event.target.value)
            }}
            className="rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            placeholder="Municipality ID"
          />
          <input
            aria-label="Responder specializations"
            value={specializations}
            onChange={(event) => {
              setSpecializations(event.target.value)
            }}
            className="rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] md:col-span-2"
            placeholder="Specializations, comma-separated"
          />
          <button
            type="submit"
            disabled={creatingResponder}
            className="rounded-md bg-[var(--color-info)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2"
          >
            {creatingResponder ? 'Creating...' : 'Create account'}
          </button>
        </form>
      )}
    </div>
  )
}

function ResponderRow({
  expanded,
  onToggle,
  responder,
}: {
  expanded: boolean
  onToggle: () => void
  responder: ResponderFleetMember
}) {
  const detailsId = `responder-details-${responder.uid}`
  const isOffline = responder.onlineStatus === 'offline'

  return (
    <li
      className={`rounded-md border border-white/10 bg-[var(--color-surface-elevated)] transition-opacity ${isOffline ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        aria-controls={detailsId}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Hide' : 'View'} ${responder.displayName} responder details`}
        title="Show responder operational details"
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
            className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5 pl-4">
          {responder.agencyId && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
              {responder.agencyId}
            </span>
          )}
          {responder.municipalityId && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
              {responder.municipalityId}
            </span>
          )}
          {!responder.agencyId && !responder.municipalityId && (
            <span className="text-[11px] text-[var(--color-text-muted)]">Jurisdiction not assigned</span>
          )}
        </span>
      </button>
      {expanded && (
        <dl
          id={detailsId}
          className="grid grid-cols-2 gap-3 border-t border-white/10 px-3 py-2 text-xs"
        >
          <div>
            <dt className="text-[var(--color-text-muted)]">Availability</dt>
            <dd className="mt-0.5 font-medium capitalize text-[var(--color-text-primary)]">
              {responder.availabilityStatus.replace('_', ' ')}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-[var(--color-text-muted)]">Last activity</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-[var(--color-text-primary)]">
              {formatLastActivity(responder.lastActivityAt)}
            </dd>
          </div>
        </dl>
      )}
    </li>
  )
}

export function ResponderAvailabilityPanel({
  responders,
  onCreateResponder,
  creatingResponder = false,
}: Props) {
  const [expandedResponderId, setExpandedResponderId] = useState<string | null>(null)

  if (responders.length === 0) {
    return (
      <div>
        {onCreateResponder && (
          <CreateResponderForm
            onCreateResponder={onCreateResponder}
            creatingResponder={creatingResponder}
          />
        )}
        <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-text-muted)]/20 bg-[var(--color-surface-elevated)] py-12 text-center">
          <Users className="mb-3 h-8 w-8 text-[var(--color-text-muted)]" aria-hidden="true" />
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            No responders online
          </h3>
          <p className="mt-1 max-w-xs text-xs text-[var(--color-text-secondary)]">
            Responders appear here when they are active in the field.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {onCreateResponder && (
        <CreateResponderForm
          onCreateResponder={onCreateResponder}
          creatingResponder={creatingResponder}
        />
      )}
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
        Responders ({responders.length})
      </h3>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {responders.map((responder) => (
          <ResponderRow
            key={responder.uid}
            responder={responder}
            expanded={expandedResponderId === responder.uid}
            onToggle={() => {
              setExpandedResponderId((current) => (current === responder.uid ? null : responder.uid))
            }}
          />
        ))}
      </ul>
    </div>
  )
}