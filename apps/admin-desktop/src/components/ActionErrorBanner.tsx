import { AlertTriangle, RotateCw, X } from 'lucide-react'

interface Props {
  message: string
  onDismiss: () => void
  onRetry?: () => void
  retrying?: boolean
}

export function ActionErrorBanner({ message, onDismiss, onRetry, retrying = false }: Props) {
  return (
    <div
      className="fixed left-1/2 top-20 z-[80] flex w-[min(92vw,38rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-surface-elevated)] px-5 py-4 text-base font-semibold text-[var(--color-danger)] shadow-2xl"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          aria-label={retrying ? 'Retrying command' : 'Retry command'}
          className="inline-flex items-center gap-1 rounded border border-[var(--color-danger)]/40 px-2 py-1 text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <RotateCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          {retrying ? 'Retrying' : 'Retry'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label="Dismiss"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  )
}
