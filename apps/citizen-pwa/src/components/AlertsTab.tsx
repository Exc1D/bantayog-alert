import { Siren, Bell } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAlerts } from '../hooks/useAlerts.js'
import type { AlertDoc } from '@bantayog/shared-types'

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
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

function AlertCard({ alert }: { alert: AlertDoc & { issuedBy?: string } }) {
  const { label, bg, color } = severityMeta(alert.severity)
  const icon = severityIcon(alert.severity)
  const isCritical = alert.severity === 'critical' || alert.severity === 'high'

  return (
    <div
      className="card"
      style={{
        marginBottom: '0.5rem',
        padding: '0.875rem',
        ...(isCritical ? { background: '#fffbfb', border: '1px solid #fecaca' } : {}),
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span
          aria-hidden="true"
          style={{ flexShrink: 0, lineHeight: 1.3, display: 'flex', alignItems: 'center' }}
        >
          {icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontWeight: 700,
                fontSize: '0.9375rem',
                color: '#001e40',
                lineHeight: 1.3,
              }}
            >
              {alert.title}
            </p>
            <span style={{ flexShrink: 0, fontSize: '0.6875rem', color: '#7b8794' }}>
              {timeAgo(alert.publishedAt)}
            </span>
          </div>
          <p
            style={{
              margin: '4px 0 8px',
              fontSize: '0.8125rem',
              color: '#374151',
              lineHeight: 1.5,
            }}
          >
            {alert.body}
          </p>
          {alert.issuedBy && (
            <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: '#6b7280' }}>
              Issued by: {alert.issuedBy}
            </p>
          )}
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
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      className="card"
      style={{ animation: 'pulse 1.6s ease-in-out infinite', marginBottom: '0.5rem' }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#e0e3e5',
            flexShrink: 0,
          }}
        />
        <div style={{ flex: 1 }}>
          <div
            style={{
              height: 14,
              width: '65%',
              background: '#e0e3e5',
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 12,
              width: '90%',
              background: '#e0e3e5',
              borderRadius: 4,
              marginBottom: 6,
            }}
          />
          <div
            style={{
              height: 12,
              width: '70%',
              background: '#e0e3e5',
              borderRadius: 4,
              marginBottom: 10,
            }}
          />
          <div style={{ height: 18, width: 60, background: '#e0e3e5', borderRadius: 999 }} />
        </div>
      </div>
    </div>
  )
}

export function AlertsTab() {
  const { alerts, loading } = useAlerts()

  const sorted = [...alerts].sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99) ||
      b.publishedAt - a.publishedAt,
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(247,249,251,0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: '12px 16px 10px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#001e40' }}>
          Alerts
          <span
            style={{
              display: 'block',
              fontSize: '0.6875rem',
              fontWeight: 400,
              color: '#7b8794',
              marginTop: 2,
            }}
          >
            Mga babala at abiso para sa inyong lugar
          </span>
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '12px 16px 24px' }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : sorted.length === 0 ? (
          <div role="status" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>✅</p>
            <p
              style={{
                margin: '0 0 6px',
                fontWeight: 700,
                color: '#001e40',
                fontSize: '0.9375rem',
              }}
            >
              No active alerts
            </p>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#52606d' }}>
              You will be notified when new alerts are issued.
              <span
                style={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  color: '#7b8794',
                  marginTop: 4,
                  fontStyle: 'italic',
                }}
              >
                Ipaaalam sa inyo kung may bagong babala.
              </span>
            </p>
          </div>
        ) : (
          sorted.map((alert) => <AlertCard key={alert.id} alert={alert} />)
        )}
      </div>
    </div>
  )
}
