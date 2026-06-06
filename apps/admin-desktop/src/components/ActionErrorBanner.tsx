import { AlertTriangle, X } from 'lucide-react'

interface Props {
  message: string
  onDismiss: () => void
}

export function ActionErrorBanner({ message, onDismiss }: Props) {
  return (
    <div
      className="fixed left-1/2 top-20 z-[80] flex w-[min(92vw,34rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-surface-elevated)] px-5 py-4 text-base font-semibold text-[var(--color-danger)] shadow-2xl"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Dismiss"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
