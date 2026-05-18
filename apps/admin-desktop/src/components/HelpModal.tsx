import { X } from 'lucide-react'
import { useEffect } from 'react'

interface Shortcut {
  key: string
  description: string
}

interface Props {
  open: boolean
  onClose: () => void
  shortcuts: Shortcut[]
}

const keyStyle =
  'inline-flex min-w-[28px] items-center justify-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-[var(--color-text-primary)]'

export function HelpModal({ open, onClose, shortcuts }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Speed up triage with these shortcuts. Press <kbd className={keyStyle}>?</kbd> anytime to
          reopen this help.
        </p>
        <div className="mt-4 space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-primary)]">{s.description}</span>
              <kbd className={keyStyle}>{s.key}</kbd>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
