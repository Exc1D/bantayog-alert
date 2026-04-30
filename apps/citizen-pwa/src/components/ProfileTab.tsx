import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, EyeOff, MapPin, Settings, User as UserIcon } from 'lucide-react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { useMyActiveReports } from '../hooks/useMyActiveReports.js'
import { incidentIcon, incidentLabel } from '../utils/incident-meta.js'
import { auth, hasFirebaseConfig } from '../services/firebase.js'
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
      className="w-full text-left cursor-pointer bg-white rounded-xl p-3.5 mb-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-[#e5e7eb]"
    >
      <div className="flex gap-2.5 items-start">
        <span aria-hidden="true" className="shrink-0 leading-snug flex items-center">
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full shrink-0 inline-block"
                style={{ background: dot }}
              />
              <p className="m-0 font-bold text-[0.9375rem] text-[#001e40]">{label}</p>
            </div>
            <span className="shrink-0 text-[0.6875rem] text-[#7b8794]">
              {timeAgo(report.submittedAt)}
            </span>
          </div>
          {report.municipalityLabel ? (
            <p className="mt-[3px] mb-1.5 text-[0.8125rem] text-[#52606d]">
              <MapPin size={12} className="inline align-middle" /> {report.municipalityLabel}
            </p>
          ) : null}
          <div className="flex gap-1.5 items-center mt-1.5">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold tracking-wide"
              style={{ background: bg, color }}
            >
              {statusLabel}
            </span>
            <span className="text-[0.6875rem] text-[#7b8794]">Ref: {report.publicRef}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-3.5 mb-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] animate-pulse">
      <div className="flex gap-2.5">
        <div className="w-6 h-6 rounded-full bg-[#e0e3e5] shrink-0" />
        <div className="flex-1">
          <div className="h-3.5 w-1/2 bg-[#e0e3e5] rounded mb-2" />
          <div className="h-3 w-[35%] bg-[#e0e3e5] rounded mb-2.5" />
          <div className="h-[18px] w-20 bg-[#e0e3e5] rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function ProfileTab() {
  const navigate = useNavigate()
  const { reports, loading } = useMyActiveReports()
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(() => hasFirebaseConfig())

  useEffect(() => {
    if (!hasFirebaseConfig()) return
    const unsub = onAuthStateChanged(auth(), (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const isPseudonymous = user?.isAnonymous === true
  const isRegistered = user && !user.isAnonymous

  const verifiedCount = reports.filter((r) => r.status === 'verified').length
  const initials =
    isRegistered && user.displayName ? user.displayName.slice(0, 2).toUpperCase() : ''

  if (authLoading) {
    return (
      <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-4 py-12 text-center">
          <SkeletonCard />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Teal hero header */}
      <div className="bg-[#0f9488] px-4 pt-12 pb-8">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            {initials ? (
              <span className="text-xl font-bold text-white">{initials}</span>
            ) : (
              <UserIcon size={32} className="text-white/80" />
            )}
          </div>
          <div className="text-center">
            <p className="m-0 text-lg font-bold text-white">
              {isRegistered ? (user.displayName ?? 'My Reports') : 'Anonymous Reporter'}
            </p>
            <p className="m-0 text-sm text-white/70 mt-0.5">
              {isRegistered ? 'Registered reporter' : 'Guest reporter'}
            </p>
          </div>
          {/* Report count badge */}
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {reports.length} {reports.length === 1 ? 'report' : 'reports'} submitted
          </span>
        </div>
      </div>

      {/* Pseudonymous banner */}
      {isPseudonymous && (
        <div className="bg-[#e8f6f3] border border-[#c4e8e2] rounded-xl mx-4 p-4 mt-4">
          <div className="flex gap-3 items-start">
            <EyeOff size={18} className="text-[#0f9488] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="m-0 text-sm font-semibold text-[#001e40] mb-1">
                You&apos;re using Bantayog anonymously
              </p>
              <p className="m-0 text-xs text-[#52606d] mb-3">
                Register to track your reports across devices.
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigate('/register')
                }}
                className="text-xs font-semibold text-[#0f9488] underline underline-offset-2 bg-transparent border-none cursor-pointer p-0"
              >
                Register to track your reports
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-3 mx-4 mt-4">
        <div className="bg-white rounded-xl p-4 flex-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <p className="m-0 text-2xl font-bold text-[#001e40]">{reports.length}</p>
          <p className="m-0 text-xs text-[#52606d] mt-0.5">Reports Submitted</p>
        </div>
        <div className="bg-white rounded-xl p-4 flex-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <p className="m-0 text-2xl font-bold text-[#0f9488]">{verifiedCount}</p>
          <p className="m-0 text-xs text-[#52606d] mt-0.5">Verified</p>
        </div>
      </div>

      {/* Settings gear row */}
      <div className="flex items-center justify-between mx-4 mt-4 bg-white rounded-xl px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <span className="text-sm font-semibold text-[#001e40]">Settings</span>
        <button
          type="button"
          onClick={() => {
            void navigate('/settings')
          }}
          aria-label="Settings"
          className="border-none bg-transparent cursor-pointer p-1 flex items-center"
        >
          <Settings size={20} className="text-[#52606d]" />
        </button>
      </div>

      {/* My Reports list */}
      <div className="px-4 pt-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : reports.length === 0 ? (
          <div role="status" className="py-9 text-center">
            <p className="m-0 mb-2 text-[#52606d]">
              <ClipboardList size={40} />
            </p>
            <p className="m-0 mb-1.5 font-bold text-[#001e40] text-[0.9375rem]">No reports yet</p>
            <p className="m-0 mb-5 text-[0.8125rem] text-[#52606d]">
              Your submitted reports will appear here.
              <span className="block text-[0.6875rem] text-[#7b8794] mt-1 italic">
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
      <div className="mx-4 mt-5 pt-5 border-t border-[#e5e7eb]">
        <h2 className="m-0 mb-3 text-sm font-bold text-[#52606d] uppercase tracking-[0.06em]">
          Privacy
        </h2>
        <DeleteAccountFlow onGoodbye={() => void navigate('/goodbye')} />
      </div>

      {/* Bottom padding for nav bar */}
      <div className="h-8" />
    </div>
  )
}
