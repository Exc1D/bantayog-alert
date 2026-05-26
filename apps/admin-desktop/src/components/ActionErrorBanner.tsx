import { AlertTriangle, X } from 'lucide-react'

interface Props {
  message: string
  onDismiss: () => void
}

export function ActionErrorBanner({ message, onDismiss }: Props) {
  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]"
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
