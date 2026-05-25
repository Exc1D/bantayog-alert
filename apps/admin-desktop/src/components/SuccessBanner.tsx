import { useEffect, useRef, useLayoutEffect } from 'react'
import { CheckCircle, X } from 'lucide-react'

interface Props {
  message: string
  onDismiss: () => void
}

export function SuccessBanner({ message, onDismiss }: Props) {
  const onDismissRef = useRef(onDismiss)

  useLayoutEffect(() => {
    onDismissRef.current = onDismiss
  })

  useEffect(() => {
    const id = setTimeout(() => {
      onDismissRef.current()
    }, 4000)
    return () => {
      clearTimeout(id)
    }
  }, [message])

  return (
    <div
      className="mb-4 flex items-center gap-3 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]"
      role="status"
    >
      <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
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
