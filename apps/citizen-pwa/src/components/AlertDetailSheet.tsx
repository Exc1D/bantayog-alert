import { useRef } from 'react'
import { Building2, Clock, X } from 'lucide-react'
import type { AlertDoc } from '@bantayog/shared-types'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { severityMeta } from '../utils/alertUtils.js'

interface AlertDetailSheetProps {
  alert: (AlertDoc & { issuedBy?: string }) | null
  open: boolean
  onClose: () => void
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  })
}

export function AlertDetailSheet({ alert, open, onClose }: AlertDetailSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useFocusTrap(sheetRef, open)

  if (!open || !alert) return null

  const { label, bg, color } = severityMeta(alert.severity)

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-surface-900/60"
        role="button"
        aria-label="Close"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClose()
          }
        }}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={alert.title}
        className="absolute bottom-0 left-0 right-0 max-h-[90svh] overflow-y-auto bg-white rounded-t-3xl p-5 shadow-2xl animate-[reveal-slide-up_0.3s_cubic-bezier(0.32,0.72,0,1)_forwards] motion-reduce:animate-none motion-reduce:translate-y-0"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-1 bg-surface-300 rounded-full mx-auto" />
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-surface-200 transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-surface-600" />
          </button>
        </div>
        <div className="p-6">
          {/* Severity badge */}
          <div className="mb-4">
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: '0.875rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                background: bg,
                color,
              }}
            >
              {label}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-surface-900 mb-4">{alert.title}</h2>

          {/* Metadata */}
          <div className="space-y-2 text-sm text-surface-600 mb-6">
            <div className="flex items-center gap-2">
              <Clock size={16} aria-hidden="true" />
              <time dateTime={new Date(alert.publishedAt).toISOString()}>
                {formatTimestamp(alert.publishedAt)}
              </time>
            </div>
            {alert.issuedBy && (
              <div className="flex items-center gap-2">
                <Building2 size={16} aria-hidden="true" />
                <span>Issued by: {alert.issuedBy}</span>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="prose prose-sm text-surface-700">
            <p className="whitespace-pre-wrap leading-relaxed">{alert.body}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white to-transparent" />
      </div>
    </div>
  )
}
