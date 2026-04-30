import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, MapPin, Settings } from 'lucide-react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { useMyActiveReports } from '../hooks/useMyActiveReports.js'
import { incidentIcon, incidentLabel } from '../utils/incident-meta.js'
import { auth } from '../services/firebase.js'
import { DeleteAccountFlow } from './DeleteAccountFlow.js'
import type { MyReport } from './MapTab/types.js'

function statusMeta(status: string): { label: string; bg: string; color: string } {
  switch (status) {
    case 'queued':
    case 'draft_inbox':
      return { label: 'Sending…', bg: '#e0e7f0', color: '#52606d' }
    case 'new':
      return { label: 'Received', bg: '#dbeafe', color: '#1e40af' }
    case 'awaiting_verify':
      return { label: 'Under review', bg: '#fef3c7', color: '#92400e' }
    case 'verified':
      return { label: 'Verified', bg: '#dbeafe', color: '#1e40af' }
    case 'assigned':
    case 'acknowledged':
      return { label: 'Help on the way', bg: '#d1fae5', color: '#065f46' }
    case 'en_route':
      return { label: 'Responder en route', bg: '#d1fae5', color: '#065f46' }
    case 'on_scene':
      return { label: 'On scene', bg: '#d1fae5', color: '#065f46' }
    case 'resolved':
    case 'closed':
      return { label: 'Resolved', bg: '#d1fae5', color: '#065f46' }
    case 'reopened':
      return { label: 'Re-opened', bg: '#dbeafe', color: '#1e40af' }
    case 'rejected':
      return { label: 'Not accepted', bg: '#fee2e2', color: '#991b1b' }
    case 'cancelled':
    case 'cancelled_false_report':
      return { label: 'Cancelled', bg: '#e0e7f0', color: '#52606d' }
    case 'merged_as_duplicate':
      return { label: 'Merged', bg: '#e0e7f0', color: '#52606d' }
    default:
      return { label: status.replace(/_/g, ' '), bg: '#e0e7f0', color: '#52606d' }
  }
}

function severityDot(severity: string): string {
  if (severity === 'high') return '#dc2626'
  if (severity === 'medium') return '#a73400'
  return '#334155'
}

function timeAgo(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function ReportCard({ report, onTap }: { report: MyReport; onTap: () => void }) {
  const icon = incidentIcon(report.reportType)
  const label = incidentLabel(report.reportType)
  const { label: statusLabel, bg, color } = statusMeta(report.status)
  const dot = severityDot(report.severity)

  return (
    <button
      type="button"
      onClick={onTap}
      className="card"
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: 'none',
        display: 'block',
        padding: '0.875rem',
        marginBottom: '0.5rem',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: dot,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: '#001e40' }}>
                {label}
              </p>
            </div>
            <span style={{ flexShrink: 0, fontSize: '0.6875rem', color: '#7b8794' }}>
              {timeAgo(report.submittedAt)}
            </span>
          </div>
          {report.municipalityLabel ? (
            <p style={{ margin: '3px 0 6px', fontSize: '0.8125rem', color: '#52606d' }}>
              <MapPin size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
              {report.municipalityLabel}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                background: bg,
                color,
              }}
            >
              {statusLabel}
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#7b8794' }}>Ref: {report.publicRef}</span>
          </div>
        </div>
      </div>
    </button>
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
              width: '50%',
              background: '#e0e3e5',
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              height: 12,
              width: '35%',
              background: '#e0e3e5',
              borderRadius: 4,
              marginBottom: 10,
            }}
          />
          <div style={{ height: 18, width: 80, background: '#e0e3e5', borderRadius: 999 }} />
        </div>
      </div>
    </div>
  )
}

export function ProfileTab() {
  const navigate = useNavigate()
  const { reports, loading } = useMyActiveReports()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth(), (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const isPseudonymous = user?.isAnonymous === true
  const isRegistered = user && !user.isAnonymous

  if (authLoading) {
    return (
      <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <SkeletonCard />
        </div>
      </div>
    )
  }

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, color: '#001e40' }}>
          {isRegistered ? (user.displayName ?? 'My Reports') : 'My Reports'}
          <span
            style={{
              display: 'block',
              fontSize: '0.6875rem',
              fontWeight: 400,
              color: '#7b8794',
              marginTop: 2,
            }}
          >
            Mga ulat na iyong isinumite
          </span>
        </h1>
        {isRegistered && (
          <button
            type="button"
            onClick={() => {
              void navigate('/settings')
            }}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: 4,
            }}
            aria-label="Settings"
          >
            <Settings size={20} color="#52606d" />
          </button>
        )}
      </div>

      {/* Pseudonymous banner */}
      {isPseudonymous && (
        <div
          style={{
            margin: '12px 16px',
            padding: '12px 16px',
            borderRadius: 10,
            background: '#fff5ef',
            border: '1px solid #fed7aa',
          }}
        >
          <p
            style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 600, color: '#001e40' }}
          >
            You&apos;re using Bantayog anonymously
          </p>
          <button
            type="button"
            onClick={() => {
              void navigate('/register')
            }}
            style={{
              border: 'none',
              background: '#f26522',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Register to track your reports
          </button>
        </div>
      )}

      {/* Report list */}
      <div style={{ padding: '12px 16px 0' }}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : reports.length === 0 ? (
          <div role="status" style={{ padding: '36px 0', textAlign: 'center' }}>
            <p style={{ margin: '0 0 8px', color: '#52606d' }}>
              <ClipboardList size={40} />
            </p>
            <p
              style={{
                margin: '0 0 6px',
                fontWeight: 700,
                color: '#001e40',
                fontSize: '0.9375rem',
              }}
            >
              No reports yet
            </p>
            <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#52606d' }}>
              Your submitted reports will appear here.
              <span
                style={{
                  display: 'block',
                  fontSize: '0.6875rem',
                  color: '#7b8794',
                  marginTop: 4,
                  fontStyle: 'italic',
                }}
              >
                Ang iyong mga ulat ay makikita dito.
              </span>
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                void navigate('/report')
              }}
            >
              Submit a report
            </button>
          </div>
        ) : (
          reports.map((report) => (
            <ReportCard
              key={report.publicRef}
              report={report}
              onTap={() => {
                void navigate(`/reports/${report.publicRef}`)
              }}
            />
          ))
        )}
      </div>

      {/* Privacy section */}
      <div
        style={{
          margin: '20px 16px 0',
          paddingTop: '20px',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <h2
          style={{
            margin: '0 0 12px',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#52606d',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Privacy
        </h2>
        <DeleteAccountFlow onGoodbye={() => void navigate('/goodbye')} />
      </div>

      {/* Bottom padding for nav bar */}
      <div style={{ height: 32 }} />
    </div>
  )
}
