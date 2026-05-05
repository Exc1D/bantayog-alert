import { useRef } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { T } from '../utils/translations.js'

interface Props {
  open: boolean
  publicRef: string
  reportType: string
  onConfirm: () => void
  onCancel: () => void
}

export function WithdrawSheet({ open, publicRef, reportType, onConfirm, onCancel }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useFocusTrap(sheetRef, open)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-modal">
      <div
        className="absolute inset-0 bg-surface-900/60"
        onClick={onCancel}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        tabIndex={0}
        role="button"
        aria-label="Close"
      />
      <div
        ref={sheetRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        className="absolute bottom-0 left-0 right-0 max-h-[70svh] bg-white rounded-t-3xl p-5 shadow-2xl
          animate-[reveal-slide-up_0.3s_cubic-bezier(0.32,0.72,0,1)_forwards]
          motion-reduce:animate-none motion-reduce:translate-y-0"
      >
        <div className="flex justify-center mb-4">
          <div className="w-8 h-1 rounded-full bg-surface-300" />
        </div>

        <h2 id="withdraw-title" className="text-lg font-bold text-surface-900 mb-2">
          {T['withdraw.title']}
        </h2>
        <p className="text-sm text-surface-500 mb-1 tl-hint">{T['withdraw.title_tl']}</p>

        <p className="text-sm text-surface-700 mb-3">{T['withdraw.body']}</p>
        <p className="text-sm text-surface-500 mb-1 tl-hint">{T['withdraw.body_tl']}</p>

        <div className="bg-surface-50 rounded-lg p-3 mb-5">
          <p className="text-sm font-medium text-surface-900">{reportType}</p>
          <p className="text-xs text-surface-500 font-mono">{publicRef}</p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 px-4 rounded-lg bg-surface-100 text-surface-900 font-medium text-sm mb-2 active:bg-surface-200 transition-colors"
        >
          {T['withdraw.keep']}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3 px-4 rounded-lg text-danger-500 font-medium text-sm active:bg-danger-500/10 transition-colors"
        >
          {T['withdraw.confirm']}
        </button>
      </div>
    </div>
  )
}
