import { ShieldCheck } from 'lucide-react'

interface Props {
  lastReportAt?: string | undefined
}

export function AllClearState({ lastReportAt }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-text-muted)]/20 bg-white/[0.03] py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/5">
        <ShieldCheck className="h-8 w-8 text-[var(--color-text-muted)]" aria-hidden="true" />
      </div>
      <h3 className="text-2xl font-semibold text-[var(--color-text-secondary)]">
        No Active Incidents
      </h3>
      <div
        className="mt-3 h-px w-32 bg-[var(--color-success)]/20 motion-safe:animate-[vigilance-pulse_3s_ease-in-out_infinite]"
        aria-hidden="true"
      />
      <p className="mt-3 max-w-sm text-sm text-[var(--color-text-muted)]">
        System monitoring is active.
      </p>
      {lastReportAt && (
        <p className="mt-3 text-xs font-mono text-[var(--color-text-muted)]">
          Last activity: {lastReportAt}
        </p>
      )}
    </div>
  )
}
