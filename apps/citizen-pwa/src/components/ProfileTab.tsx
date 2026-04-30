import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  EyeOff,
  MapPin,
  Settings,
  User as UserIcon,
  Award,
  ShieldCheck,
  HeartHandshake,
  Flame,
  TrendingUp,
  ChevronRight,
} from 'lucide-react'
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
      return { label: 'Sending…', bg: 'bg-surface-200', color: 'text-surface-600' }
    case 'new':
      return { label: 'Received', bg: 'bg-brand-100', color: 'text-brand-600' }
    case 'awaiting_verify':
      return { label: 'Under review', bg: 'bg-warning-400/20', color: 'text-warning-500' }
    case 'verified':
      return { label: 'Verified', bg: 'bg-brand-100', color: 'text-brand-600' }
    case 'assigned':
    case 'acknowledged':
      return { label: 'Help on the way', bg: 'bg-success-400/20', color: 'text-success-500' }
    case 'en_route':
      return { label: 'Responder en route', bg: 'bg-success-400/20', color: 'text-success-500' }
    case 'on_scene':
      return { label: 'On scene', bg: 'bg-success-400/20', color: 'text-success-500' }
    case 'resolved':
    case 'closed':
      return { label: 'Resolved', bg: 'bg-success-400/20', color: 'text-success-500' }
    case 'reopened':
      return { label: 'Re-opened', bg: 'bg-brand-100', color: 'text-brand-600' }
    case 'rejected':
      return { label: 'Not accepted', bg: 'bg-danger-400/20', color: 'text-danger-500' }
    case 'cancelled':
    case 'cancelled_false_report':
      return { label: 'Cancelled', bg: 'bg-surface-200', color: 'text-surface-600' }
    case 'merged_as_duplicate':
      return { label: 'Merged', bg: 'bg-surface-200', color: 'text-surface-600' }
    default:
      return { label: status.replace(/_/g, ' '), bg: 'bg-surface-200', color: 'text-surface-600' }
  }
}

function severityDot(severity: string): string {
  if (severity === 'high') return '#dc2626'
  if (severity === 'medium') return '#d97706'
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

/* ── Badge system ── */
interface BadgeDef {
  id: string
  label: string
  description: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  earned: boolean
}

function useBadges(reports: MyReport[]): BadgeDef[] {
  const count = reports.length
  const verifiedCount = reports.filter((r) => r.status === 'verified').length

  return [
    {
      id: 'first-report',
      label: 'First Report',
      description: 'You started helping your community',
      Icon: Award,
      earned: count >= 1,
    },
    {
      id: 'verified-reporter',
      label: 'Verified Reporter',
      description: 'A report you filed was verified',
      Icon: ShieldCheck,
      earned: verifiedCount >= 1,
    },
    {
      id: 'community-helper',
      label: 'Community Helper',
      description: 'Filed 3+ reports',
      Icon: HeartHandshake,
      earned: count >= 3,
    },
    {
      id: 'active-citizen',
      label: 'Active Citizen',
      description: 'Filed 5+ reports',
      Icon: Flame,
      earned: count >= 5,
    },
  ]
}

/* ── Report milestone tracker ── */
function MilestoneTracker({ reports }: { reports: MyReport[] }) {
  const counts = {
    sent: reports.length,
    review: reports.filter((r) => r.status === 'awaiting_verify').length,
    verified: reports.filter((r) => r.status === 'verified').length,
    resolved: reports.filter((r) => r.status === 'resolved' || r.status === 'closed').length,
  }

  const data = [
    { label: 'Report sent', count: counts.sent },
    { label: 'Under review', count: counts.review },
    { label: 'Verified', count: counts.verified },
    { label: 'Resolved', count: counts.resolved },
  ]

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4 mx-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-brand-500" />
        <h2 className="text-sm font-semibold text-surface-700">Report Milestones</h2>
      </div>
      <div className="flex gap-2">
        {data.map((m, i) => {
          const isActive = m.count > 0
          const isLast = i === data.length - 1
          return (
            <div key={m.label} className="flex-1 flex items-center gap-2">
              <div className="flex-1">
                <div
                  className={`h-2 rounded-full transition-colors ${
                    isActive ? 'bg-brand-500' : 'bg-surface-200'
                  }`}
                />
                <p
                  className={`text-[10px] mt-1.5 text-center font-medium ${isActive ? 'text-surface-700' : 'text-surface-400'}`}
                >
                  {m.label}
                </p>
                {isActive && (
                  <p className="text-[10px] text-center text-brand-500 font-semibold">{m.count}</p>
                )}
              </div>
              {!isLast && (
                <div className={`w-3 h-px ${isActive ? 'bg-brand-500' : 'bg-surface-200'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Report card ── */
function ReportCard({ report, onTap }: { report: MyReport; onTap: () => void }) {
  const icon = incidentIcon(report.reportType)
  const label = incidentLabel(report.reportType)
  const { label: statusLabel, bg, color } = statusMeta(report.status)
  const dot = severityDot(report.severity)

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left cursor-pointer bg-white rounded-xl p-3.5 mb-2 border border-surface-200 shadow-sm active:scale-[0.99] transition-transform"
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
              <p className="m-0 font-bold text-[0.9375rem] text-surface-900">{label}</p>
            </div>
            <span className="shrink-0 text-[0.6875rem] text-surface-400">
              {timeAgo(report.submittedAt)}
            </span>
          </div>
          {report.municipalityLabel ? (
            <p className="mt-[3px] mb-1.5 text-[0.8125rem] text-surface-600">
              <MapPin size={12} className="inline align-middle" /> {report.municipalityLabel}
            </p>
          ) : null}
          <div className="flex gap-1.5 items-center mt-1.5">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold tracking-wide ${bg} ${color}`}
            >
              {statusLabel}
            </span>
            <span className="text-[0.6875rem] text-surface-400">Ref: {report.publicRef}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

/* ── Skeleton card ── */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-3.5 mb-2 border border-surface-200 animate-pulse">
      <div className="flex gap-2.5">
        <div className="w-6 h-6 rounded-full bg-surface-200 shrink-0" />
        <div className="flex-1">
          <div className="h-3.5 w-1/2 bg-surface-200 rounded mb-2" />
          <div className="h-3 w-[35%] bg-surface-200 rounded mb-2.5" />
          <div className="h-[18px] w-20 bg-surface-200 rounded-full" />
        </div>
      </div>
    </div>
  )
}

/* ── Main component ── */
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

  const badges = useBadges(reports)
  const earnedBadges = badges.filter((b) => b.earned)

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
    <div
      className="h-full overflow-y-auto bg-surface-100"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Teal hero header */}
      <div className="bg-brand-500 px-4 pt-12 pb-8">
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
          <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {reports.length} {reports.length === 1 ? 'report' : 'reports'} submitted
          </span>
        </div>
      </div>

      {/* Pseudonymous banner */}
      {isPseudonymous && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl mx-4 p-4 mt-4">
          <div className="flex gap-3 items-start">
            <EyeOff size={18} className="text-brand-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="m-0 text-sm font-semibold text-surface-900 mb-1">
                You&apos;re using Bantayog anonymously
              </p>
              <p className="m-0 text-xs text-surface-500 mb-3">
                Register to track your reports across devices.
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigate('/register')
                }}
                className="text-xs font-semibold text-brand-500 underline underline-offset-2 bg-transparent border-none cursor-pointer p-0"
              >
                Register to track your reports
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-3 mx-4 mt-4">
        <div className="bg-white rounded-xl p-4 flex-1 border border-surface-200 shadow-sm">
          <p className="m-0 text-2xl font-bold text-surface-900">{reports.length}</p>
          <p className="m-0 text-xs text-surface-500 mt-0.5">Reports Submitted</p>
        </div>
        <div className="bg-white rounded-xl p-4 flex-1 border border-surface-200 shadow-sm">
          <p className="m-0 text-2xl font-bold text-brand-500">{verifiedCount}</p>
          <p className="m-0 text-xs text-surface-500 mt-0.5">Verified</p>
        </div>
      </div>

      {/* Badges */}
      {earnedBadges.length > 0 && (
        <div className="mx-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-brand-500" />
            <h2 className="text-sm font-semibold text-surface-700">Achievements</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border transition-opacity ${
                  badge.earned
                    ? 'bg-white border-surface-200 shadow-sm'
                    : 'bg-surface-100 border-surface-200 opacity-40'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    badge.earned ? 'bg-brand-100' : 'bg-surface-200'
                  }`}
                >
                  <badge.Icon
                    size={16}
                    className={badge.earned ? 'text-brand-500' : 'text-surface-400'}
                  />
                </div>
                <div>
                  <p
                    className={`text-xs font-semibold ${badge.earned ? 'text-surface-900' : 'text-surface-400'}`}
                  >
                    {badge.label}
                  </p>
                  <p className="text-[10px] text-surface-400">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      {reports.length > 0 && <MilestoneTracker reports={reports} />}

      {/* Settings card */}
      <div className="mx-4 mt-4 bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => {
            void navigate('/settings')
          }}
          aria-label="Settings"
          className="w-full flex items-center justify-between px-4 py-3.5 bg-transparent border-none cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center">
              <Settings size={16} className="text-surface-600" />
            </div>
            <div>
              <p className="m-0 text-sm font-semibold text-surface-900">Settings</p>
              <p className="m-0 text-xs text-surface-400">Account, notifications, privacy</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-surface-400" />
        </button>
      </div>

      {/* My Reports list */}
      <div className="px-4 pt-4">
        <h2 className="text-sm font-semibold text-surface-700 mb-3">My Reports</h2>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : reports.length === 0 ? (
          <div role="status" className="py-9 text-center">
            <p className="m-0 mb-2 text-surface-400">
              <ClipboardList size={40} />
            </p>
            <p className="m-0 mb-1.5 font-bold text-surface-900 text-[0.9375rem]">No reports yet</p>
            <p className="m-0 mb-5 text-[0.8125rem] text-surface-500">
              Your submitted reports will appear here.
              <span className="block text-[0.6875rem] text-surface-400 mt-1 italic">
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
      <div className="mx-4 mt-5 pt-5 border-t border-surface-200 pb-8">
        <h2 className="m-0 mb-3 text-sm font-semibold text-surface-700">Privacy</h2>
        <DeleteAccountFlow onGoodbye={() => void navigate('/goodbye')} />
      </div>

      {/* Bottom padding for nav bar */}
      <div className="h-8" />
    </div>
  )
}
