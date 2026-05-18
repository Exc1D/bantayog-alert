import { ShieldCheck } from 'lucide-react'

interface Props {
  lastReportAt?: string | undefined
}

export function AllClearState({ lastReportAt }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/10">
        <ShieldCheck className="h-8 w-8 text-[var(--color-success)]" aria-hidden="true" />
      </div>
      <h3 className="text-2xl font-semibold text-[var(--color-success)]">All Clear</h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--color-text-secondary)]">
        No reports require triage. System monitoring is active.
      </p>
      {lastReportAt && (
        <p className="mt-3 text-xs font-mono text-[var(--color-text-muted)]">
          Last activity: {lastReportAt}
        </p>
      )}
    </div>
  )
}
