import { useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [open])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onCancel()
      }
    },
    [onCancel],
  )

  if (!open) return null

  const confirmBg =
    confirmVariant === 'danger' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-sienna)]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="presentation"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onCancel()
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-lg border border-[var(--color-navy)] bg-[var(--color-surface-elevated)] p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <h2 id="confirm-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button onClick={onCancel} className="rounded p-1 hover:bg-white/10" aria-label="Close">
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm text-white ${confirmBg} hover:opacity-90`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
