import { type ReactNode, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  message: string
  children?: ReactNode
  confirmLabel: string
  confirmVariant?: 'danger' | 'primary'
  confirmLoading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function ConfirmationModal({
  open,
  title,
  message,
  children,
  confirmLabel,
  confirmVariant = 'danger',
  confirmLoading,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [open])

  const handleCancel = useCallback(() => {
    if (!confirmLoading) {
      onCancel()
    }
  }, [confirmLoading, onCancel])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        handleCancel()
      }
    },
    [handleCancel],
  )

  if (!open) return null

  const confirmBg =
    confirmVariant === 'danger' ? 'bg-[var(--color-danger)]' : 'bg-[var(--color-success)]'

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[var(--color-surface)]/80"
      role="presentation"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          handleCancel()
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-6 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <h2 id="confirm-title" className="text-lg font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button
            onClick={handleCancel}
            disabled={confirmLoading}
            className="rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{message}</p>
        {children}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={confirmLoading}
            className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              void onConfirm()
            }}
            disabled={confirmLoading}
            className={`rounded-md px-4 py-2 text-sm text-white ${confirmBg} hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {confirmLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
