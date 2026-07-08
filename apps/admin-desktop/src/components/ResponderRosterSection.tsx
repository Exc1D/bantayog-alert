import { UserCheck } from 'lucide-react'
import type { ResponderRosterMember } from '../hooks/useResponderRoster'

const AVAILABILITY_LABEL: Record<ResponderRosterMember['availabilityStatus'], string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  off_duty: 'Off-duty',
}

const ACCOUNT_CHIP: Record<ResponderRosterMember['accountStatus'], string> = {
  active: 'border-white/10 bg-white/5 text-[var(--color-text-secondary)]',
  suspended: 'border-[var(--color-warning)]/40 text-[var(--color-warning)]',
  revoked: 'border-[var(--color-danger)]/40 text-[var(--color-danger)]',
}

/** Off-shift/unavailable responders — the complement of the available-only fleet panel. */
export function partitionRoster(members: ResponderRosterMember[]): ResponderRosterMember[] {
  return members.filter((m) => m.availabilityStatus !== 'available')
}

/** Availability can be reset to available; suspend/revoke reversal is a backend-only concern. */
export function canReinstate(member: ResponderRosterMember): boolean {
  return member.accountStatus === 'active' && member.availabilityStatus !== 'available'
}

export function ResponderRosterSection({
  members,
  onReinstate,
  reinstatingUid,
}: {
  members: ResponderRosterMember[]
  onReinstate: (uid: string) => void
  reinstatingUid?: string | null
}) {
  const offShift = partitionRoster(members)
  if (offShift.length === 0) return null

  return (
    <section
      aria-label="Off-shift responders"
      className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-3"
    >
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
        Off-shift &amp; unavailable ({offShift.length})
      </h3>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {offShift.map((member) => (
          <li
            key={member.uid}
            className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">
                {member.displayName || member.uid}
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {AVAILABILITY_LABEL[member.availabilityStatus]}
                </span>
                {member.accountStatus !== 'active' && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${ACCOUNT_CHIP[member.accountStatus]}`}
                  >
                    {member.accountStatus}
                  </span>
                )}
              </span>
            </span>
            {canReinstate(member) ? (
              <button
                type="button"
                disabled={reinstatingUid === member.uid}
                onClick={() => {
                  onReinstate(member.uid)
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--color-success)]/40 px-2 py-1 text-[11px] font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-success)]/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {reinstatingUid === member.uid ? 'Setting…' : 'Set available'}
              </button>
            ) : (
              <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                Reinstate via account tools
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
