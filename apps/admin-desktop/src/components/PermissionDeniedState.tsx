import { LogOut, ShieldAlert } from 'lucide-react'

interface Props {
  onSignOut: () => void
}

export function PermissionDeniedState({ onSignOut }: Props) {
  return (
    <section
      aria-labelledby="permission-denied-title"
      className="mx-auto flex min-h-[24rem] max-w-2xl flex-col items-center justify-center rounded border border-white/10 bg-[var(--color-surface-elevated)] px-6 py-10 text-center"
    >
      <div className="mb-4 rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-3 text-[var(--color-warning)]">
        <ShieldAlert className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1
        id="permission-denied-title"
        className="text-2xl font-semibold text-[var(--color-text-primary)]"
      >
        You don&apos;t have access to this data
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
        Your role or area assignment may have changed, or this session may be using stale account
        claims. Sign out and sign back in with an active admin account for the correct municipality
        or agency.
      </p>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-6 inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out and sign back in
      </button>
    </section>
  )
}
