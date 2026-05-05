import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { T } from '../utils/translations.js'

interface Props {
  open: boolean
  publicRef: string
  reportType: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteSheet({ open, publicRef, reportType, onConfirm, onCancel }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useFocusTrap(sheetRef, open)

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
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
        aria-labelledby="delete-title"
        className="absolute bottom-0 left-0 right-0 max-h-[70svh] bg-white rounded-t-3xl p-5 shadow-2xl
          animate-[reveal-slide-up_0.3s_cubic-bezier(0.32,0.72,0,1)_forwards]
          motion-reduce:animate-none motion-reduce:translate-y-0"
      >
        <div className="flex justify-center mb-4">
          <div className="w-8 h-1 rounded-full bg-surface-300" />
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-danger-500/10 flex items-center justify-center flex-shrink-0">
            <Trash2 size={20} className="text-danger-500" />
          </div>
          <div>
            <h2 id="delete-title" className="text-lg font-bold text-surface-900">
              {T['delete.title']}
            </h2>
            <p className="text-sm text-surface-500 tl-hint">{T['delete.title_tl']}</p>
          </div>
        </div>

        <p className="text-sm text-surface-700 mb-3">{T['delete.body']}</p>
        <p className="text-sm text-surface-500 mb-4 tl-hint">{T['delete.body_tl']}</p>

        <div className="bg-surface-50 rounded-lg p-3 mb-5">
          <p className="text-sm font-medium text-surface-900">{reportType}</p>
          <p className="text-xs text-surface-500 font-mono">{publicRef}</p>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3 px-4 rounded-lg bg-danger-500 text-white font-medium text-sm mb-2 active:bg-danger-600 transition-colors"
        >
          {T['delete.confirm']}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 px-4 rounded-lg bg-surface-100 text-surface-900 font-medium text-sm active:bg-surface-200 transition-colors"
        >
          {T['delete.keep']}
        </button>
      </div>
    </div>,
    document.body,
  )
}
