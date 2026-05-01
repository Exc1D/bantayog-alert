import { Building2, Clock } from 'lucide-react'
import type { AlertDoc } from '@bantayog/shared-types'
import { RevealSheet } from './RevealSheet.js'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

interface AlertDetailSheetProps {
  alert: AlertDoc & { issuedBy?: string }
  open: boolean
  onClose: () => void
}

function severityMeta(severity: string): { label: string; bg: string; color: string } {
  switch (severity) {
    case 'critical':
      return { label: 'CRITICAL', bg: '#fecaca', color: '#7f1d1d' }
    case 'high':
      return { label: 'HIGH', bg: '#fee2e2', color: '#991b1b' }
    case 'medium':
      return { label: 'MEDIUM', bg: '#fff5ef', color: '#a73400' }
    case 'low':
      return { label: 'LOW', bg: '#e0e7f0', color: '#001e40' }
    default:
      return { label: 'INFO', bg: '#dbeafe', color: '#1e40af' }
  }
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  })
}

export function AlertDetailSheet({ alert, open, onClose }: AlertDetailSheetProps) {
  const prefersReducedMotion = useReducedMotion()
  const { label, bg, color } = severityMeta(alert.severity)

  return (
    <RevealSheet open={open} onClose={onClose} disableAnimation={prefersReducedMotion}>
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
    </RevealSheet>
  )
}
