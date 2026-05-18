import { Check } from 'lucide-react'

interface Props {
  lastCheckedAt?: string
}

export function EmptyTriageState({ lastCheckedAt }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
      <Check
        className="mb-2 h-8 w-8 text-[var(--color-success)]"
        role="status"
        aria-label="All reports triaged"
      />
      <p className="text-lg font-medium text-[var(--color-text-primary)]">All Caught Up</p>
      <p className="text-sm text-[var(--color-text-secondary)]">No reports pending verification</p>
      {lastCheckedAt && <p className="mt-1 text-xs">Last checked: {lastCheckedAt}</p>}
    </div>
  )
}
