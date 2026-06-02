import { useState } from 'react'
import { Siren, Bell, AlertTriangle, Building2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAlerts } from '../hooks/useAlerts.js'
import { useAlertReadState } from '../hooks/useAlertReadState.js'
import { AlertDetailSheet } from './AlertDetailSheet.js'
import { severityMeta } from '../utils/alertUtils.js'
import type { AlertDoc } from '@bantayog/shared-types'

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
}

function severityBorderClass(): string {
  // Side-stripe borders removed (WCAG AAA violation)
  // Severity is conveyed via icon + badge instead
  return 'border-surface-200'
}

function severityIconColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#dc2626'
    case 'high':
    case 'warning':
    case 'medium':
      return '#d97706'
    case 'low':
      return '#64748b'
    case 'info':
      return '#2563eb'
    default:
      return '#059669'
  }
}

function severityIcon(severity: string): ReactNode {
  if (severity === 'critical' || severity === 'high') return <Siren size={16} />
  return <Bell size={16} />
}

function timeAgo(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function AlertCard({
  alert,
  onClick,
  isUnread,
  style,
}: {
  alert: AlertDoc & { issuedBy?: string }
  onClick: () => void
  isUnread: boolean
  style?: React.CSSProperties
}) {
  const { label, bg, color } = severityMeta(alert.severity)
  const icon = severityIcon(alert.severity)
  const borderClass = severityBorderClass()
  const iconColor = severityIconColor(alert.severity)

  return (
    <button
      type="button"
      data-testid={`alert-card-${alert.id}`}
      onClick={onClick}
      className={`bg-white rounded-xl mx-3 my-2 overflow-hidden border ${borderClass} text-left w-full cursor-pointer hover:bg-surface-50 transition-colors relative motion-fade-in`}
      style={style}
    >
      {/* Unread indicator dot */}
      {isUnread && (
        <span
          className="absolute top-4 right-4 w-2 h-2 rounded-full bg-brand-500"
          aria-hidden="true"
        />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between">
          <span
            aria-hidden="true"
            className="flex-shrink-0 flex items-center mr-2"
            style={{ color: iconColor }}
          >
            {icon}
          </span>
          <p className="font-semibold text-surface-900 text-sm flex-1">{alert.title}</p>
          <span className="text-xs text-surface-500 ml-2 flex-shrink-0">
            {timeAgo(alert.publishedAt)}
          </span>
        </div>
        <p className="text-xs text-surface-700 mt-1 leading-relaxed">{alert.body}</p>
        {alert.issuedBy && (
          <p className="text-xs text-surface-500 mt-1 flex items-center gap-1">
            <Building2 size={12} aria-hidden="true" />
            {`Issued by: ${alert.issuedBy}`}
          </p>
        )}
        <p className="text-xs text-surface-500 mt-2">
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: bg,
              color,
            }}
          >
            {label}
          </span>
        </p>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl mx-3 my-2 overflow-hidden border border-surface-200">
      <div className="p-4 flex gap-2">
        <div className="w-6 h-6 rounded-full shimmer-gradient flex-shrink-0" />
        <div className="flex-1">
          <div className="h-3.5 w-[65%] rounded shimmer-gradient mb-2" />
          <div className="h-3 w-[90%] rounded shimmer-gradient mb-1.5" />
          <div className="h-3 w-[70%] rounded shimmer-gradient mb-2.5" />
          <div className="h-4 w-14 rounded-full shimmer-gradient" />
        </div>
      </div>
    </div>
  )
}

export function AlertsTab() {
  const { alerts, loading, error } = useAlerts()
  const { markAsRead, isUnread, unreadCount } = useAlertReadState()
  const [selectedAlert, setSelectedAlert] = useState<(AlertDoc & { issuedBy?: string }) | null>(
    null,
  )

  const sorted = [...alerts].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99) ||
      b.publishedAt - a.publishedAt,
  )

  const hasCritical = sorted.some((a) => a.severity === 'critical')
  const alertIds = sorted.map((a) => a.id)
  const unread = unreadCount(alertIds)

  const handleAlertClick = (alert: AlertDoc & { issuedBy?: string }) => {
    setSelectedAlert(alert)
    markAsRead(alert.id)
  }

  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/95 px-4 py-4 border-b border-surface-200">
        <h1 className="text-xl font-bold text-surface-900">Alerts</h1>
        {unread > 0 && (
          <p className="text-xs text-surface-500 mt-1">
            {unread} unread alert{unread !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Active emergency strip */}
      {hasCritical && (
        <div className="bg-danger-600/10 border-b border-danger-600/20 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={16} className="text-danger-600 flex-shrink-0" />
          <span className="text-sm font-bold text-danger-600">
            Active emergency alert in effect
          </span>
        </div>
      )}

      {/* Content */}
      <div className="py-3 pb-6">
        {loading ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">Loading alerts</span>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="flex flex-col items-center justify-center min-h-[50vh] text-surface-500 px-4 text-center"
          >
            <AlertTriangle size={40} className="text-danger-600 mb-2" />
            <p className="font-bold text-surface-900 text-sm mb-1">Could not load alerts</p>
            <p className="text-xs">
              {error instanceof Error ? error.message : 'Please try again later.'}
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex flex-col items-center justify-center min-h-[50vh] text-surface-500 px-4 text-center"
          >
            <Bell size={40} className="mb-2" />
            <p className="font-bold text-surface-900 text-sm mb-1">No active alerts</p>
            <p className="text-xs">You will be notified when new alerts are issued.</p>
          </div>
        ) : (
          sorted.map((alert, index) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onClick={() => {
                handleAlertClick(alert)
              }}
              isUnread={isUnread(alert.id)}
              style={{ '--i': index } as React.CSSProperties}
            />
          ))
        )}
      </div>

      {/* Alert detail sheet */}
      <AlertDetailSheet
        alert={selectedAlert}
        open={selectedAlert !== null}
        onClose={() => {
          setSelectedAlert(null)
        }}
      />
    </div>
  )
}
