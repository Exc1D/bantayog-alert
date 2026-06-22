import { useState } from 'react'
import { UserPlus, Users } from 'lucide-react'
import { ResponderAvailabilityRow } from './ResponderAvailabilityRow'
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
          <ResponderAvailabilityRow
            key={responder.uid}
            responder={responder}
            expanded={expandedResponderId === responder.uid}
            onToggle={() => {
              setExpandedResponderId((current) =>
                current === responder.uid ? null : responder.uid,
              )
            }}
          />
        ))}
      </ul>
    </div>
  )
}
