import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  MapPin,
  Search,
  Settings,
  User as UserIcon,
  Award,
  ShieldCheck,
  HeartHandshake,
  TrendingUp,
  ChevronRight,
  Lock,
  LogOut,
  CheckCircle,
} from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { useMyActiveReports } from '../hooks/useMyActiveReports.js'
import {
  incidentIcon,
  incidentLabel,
  statusMeta,
  severityDotColor,
} from '../utils/incident-meta.js'
import { auth, hasFirebaseConfig } from '../services/firebase.js'
import type { MyReport } from './MapTab/types.js'

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

const BADGE_DEFS: Omit<BadgeDef, 'earned'>[] = [
  {
    id: 'first-report',
    label: 'First Report',
    description: 'You started helping your community',
    Icon: Award,
  },
  {
    id: 'verified-reporter',
    label: 'Verified Reporter',
    description: 'A report you filed was verified',
    Icon: ShieldCheck,
  },
  {
    id: 'community-helper',
    label: 'Community Helper',
    description: 'Reports added community context',
    Icon: HeartHandshake,
  },
  {
    id: 'active-citizen',
    label: 'Local Signal',
    description: 'Reports helped map local risk',
    Icon: MapPin,
  },
]

function useBadges(reports: MyReport[]): BadgeDef[] {
  const count = reports.length
  const verifiedCount = reports.filter((r) => r.status === 'verified').length
  return useMemo(
    () =>
      BADGE_DEFS.map((def) => ({
        ...def,
        earned:
          def.id === 'first-report'
            ? count >= 1
            : def.id === 'verified-reporter'
              ? verifiedCount >= 1
              : def.id === 'community-helper'
                ? count >= 3
                : count >= 5,
      })),
    [count, verifiedCount],
  )
}

/* ── Guardian pitch card ── */
function GuardianPitchCard({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="mx-4 mt-4 bg-brand-500 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={16} className="text-white/90" />
        <span className="text-white/90 text-xs font-bold uppercase tracking-wider">
          Guardian Network
        </span>
      </div>
      <h2 className="m-0 text-white text-xl font-bold leading-tight mb-1">Become a Guardian</h2>
      <p className="m-0 text-white/80 text-sm mb-4 leading-relaxed">
        Samahan mo kaming magbantay. Register to keep report history, track verified impact, and
        help your community when it matters most.
      </p>
      <div className="flex flex-col gap-2 mb-4">
        {[
          'Track your reports across devices',
          'Build real reporting skill',
          'Share useful status updates',
        ].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle size={14} className="text-white/80 shrink-0" />
            <span className="text-white/90 text-xs">{item}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onRegister}
        className="w-full py-3 rounded-xl bg-white text-brand-600 font-bold text-sm active:bg-brand-50 transition-colors cursor-pointer border-none"
      >
        Create account
      </button>
    </div>
  )
}

/* ── Report milestone tracker ── */
function impactGuidance(counts: {
  sent: number
  review: number
  verified: number
  resolved: number
}): string {
  if (counts.resolved > 0) return 'Response loop complete. Keep the reference for your records.'
  if (counts.verified > 0)
    return 'Verified signal. Watch for responder updates before sending duplicates.'
  if (counts.review > 0)
    return 'Under review. Keep your phone nearby in case responders need details.'
  return 'Report sent. Keep the reference code ready until it is verified.'
}

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
  const activeSignals = data.filter((m) => m.count > 0).length
  const guidance = impactGuidance(counts)

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4 mx-4 mt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-500" />
          <h2 className="text-sm font-semibold text-surface-700">Impact Path</h2>
        </div>
        <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-1 rounded-full">
          {activeSignals}/4 signals
        </span>
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
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-100 px-3 py-2">
        <CheckCircle size={14} className="text-brand-500 shrink-0 mt-0.5" />
        <p className="m-0 text-xs leading-relaxed text-surface-600">{guidance}</p>
      </div>
    </div>
  )
}

/* ── Report card ── */
function ReportCard({ report, onTap }: { report: MyReport; onTap: () => void }) {
  const icon = incidentIcon(report.reportType)
  const label = incidentLabel(report.reportType)
  const { label: statusLabel, bg, color } = statusMeta(report.status)
  const dot = severityDotColor(report.severity)

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
    <div className="bg-white rounded-xl p-3.5 mb-2 border border-surface-200 motion-safe:animate-pulse">
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
  const resolvedCount = reports.filter(
    (r) => r.status === 'resolved' || r.status === 'closed',
  ).length
  const uniqueAreas = new Set(reports.map((r) => r.municipalityLabel).filter(Boolean)).size
  const [daysAsGuardian, setDaysAsGuardian] = useState(0)
  useEffect(() => {
    /* Derived from reports + current time; must compute synchronously on mount. */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (reports.length === 0) {
      setDaysAsGuardian(0)
      return
    }
    const minTs = reports.reduce((min, r) => Math.min(min, r.submittedAt), Infinity)
    setDaysAsGuardian(Math.max(1, Math.floor((Date.now() - minTs) / 86400000)))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [reports])

  const [signOutError, setSignOutError] = useState(false)

  const handleSignOut = async () => {
    setSignOutError(false)
    try {
      await signOut(auth())
      void navigate('/', { replace: true })
    } catch {
      setSignOutError(true)
    }
  }

  const handleShare = async () => {
    const text = `I've helped keep my community safe by filing ${String(reports.length)} ${reports.length === 1 ? 'report' : 'reports'} on Bantayog Alert.`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text, url: window.location.origin })
      } else {
        await navigator.clipboard.writeText(text)
      }
    } catch {
      // user cancelled or API unavailable
    }
  }

  if (authLoading) {
    return (
      <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-4 py-12 text-center">
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div
        className="h-full overflow-y-auto bg-surface-100"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Hero */}
        <div className="bg-brand-500 px-4 pt-12 pb-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <ShieldCheck size={32} className="text-white/70" />
            </div>
            <div className="text-center">
              <p className="m-0 text-lg font-bold text-white">Community Guardian</p>
              <p className="m-0 text-sm text-white/70 mt-0.5">Not yet registered</p>
            </div>
          </div>
        </div>

        {/* Main pitch */}
        <GuardianPitchCard
          onRegister={() => {
            void navigate('/register')
          }}
        />

        {/* Locked badge previews — what you'll earn */}
        <div className="mx-4 mt-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-surface-400" />
            <h2 className="m-0 text-sm font-semibold text-surface-500">Guardian Skills</h2>
            <span className="text-[10px] text-surface-400 ml-auto">Register to track</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {BADGE_DEFS.map((badge) => (
              <div
                key={badge.id}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border bg-surface-100 border-surface-200 opacity-60"
              >
                <div className="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center relative">
                  <badge.Icon size={16} className="text-surface-400" />
                  <Lock size={8} className="absolute -bottom-0.5 -right-0.5 text-surface-500" />
                </div>
                <div>
                  <p className="m-0 text-xs font-semibold text-surface-400">{badge.label}</p>
                  <p className="m-0 text-[10px] text-surface-400">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Track existing report */}
        <div className="mx-4 mt-4">
          <button
            type="button"
            onClick={() => {
              void navigate('/lookup')
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-surface-200 shadow-sm active:bg-surface-50 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center shrink-0">
              <Search size={16} className="text-surface-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="m-0 text-sm font-semibold text-surface-900">Check report status</p>
              <p className="m-0 text-xs text-surface-400">Enter reference &amp; secret code</p>
            </div>
          </button>
        </div>

        {/* Settings — accessible before registration */}
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
                <p className="m-0 text-xs text-surface-400">Notifications, privacy, storage</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-surface-400" />
          </button>
        </div>

        <div className="h-8" />
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
          <div className="flex gap-2 flex-wrap justify-center">
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
              {reports.length} {reports.length === 1 ? 'report' : 'reports'} submitted
            </span>
            {daysAsGuardian > 0 && (
              <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {daysAsGuardian}d as guardian
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Guardian pitch for anonymous (pseudonymous) users */}
      {isPseudonymous && (
        <GuardianPitchCard
          onRegister={() => {
            void navigate('/register')
          }}
        />
      )}

      {/* Login link for anonymous users */}
      {isPseudonymous && (
        <div className="mx-4 mt-3">
          <button
            type="button"
            onClick={() => {
              void navigate('/login')
            }}
            className="inline-block w-full px-4 py-2 h-11 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors border-none cursor-pointer"
          >
            Already have an account? Sign In
          </button>
        </div>
      )}

      {/* Stats grid — Your Impact */}
      <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
        <div className="bg-white rounded-xl p-4 border border-surface-200 shadow-sm">
          <p className="m-0 text-2xl font-bold text-surface-900">{reports.length}</p>
          <p className="m-0 text-xs text-surface-500 mt-0.5">Reports Submitted</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-surface-200 shadow-sm">
          <p className="m-0 text-2xl font-bold text-brand-500">{verifiedCount}</p>
          <p className="m-0 text-xs text-surface-500 mt-0.5">Verified</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-surface-200 shadow-sm">
          <p className="m-0 text-2xl font-bold text-success-500">{resolvedCount}</p>
          <p className="m-0 text-xs text-surface-500 mt-0.5">Resolved</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-surface-200 shadow-sm">
          <p className="m-0 text-2xl font-bold text-surface-900">
            {uniqueAreas > 0 ? uniqueAreas : '—'}
          </p>
          <p className="m-0 text-xs text-surface-500 mt-0.5">Areas Helped</p>
        </div>
      </div>

      {/* Badges — always visible for motivational progress */}
      <div className="mx-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Award size={16} className="text-brand-500" />
          <h2 className="text-sm font-semibold text-surface-700">Guardian Skills</h2>
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

      {/* Milestones */}
      {reports.length > 0 && <MilestoneTracker reports={reports} />}

      {/* Share prompt */}
      {reports.length > 0 && (
        <div className="mx-4 mt-4 bg-brand-50 rounded-xl border border-brand-200 p-4">
          <p className="m-0 text-sm font-semibold text-surface-900 mb-1">
            You&apos;ve helped your community {reports.length}{' '}
            {reports.length === 1 ? 'time' : 'times'}
          </p>
          <p className="m-0 text-xs text-surface-500 mb-3">
            Share that you&apos;re making a difference. Ibahagi ang iyong kontribusyon.
          </p>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="text-xs font-semibold text-brand-500 border border-brand-300 bg-white rounded-lg px-3 py-2 active:bg-brand-50 transition-colors cursor-pointer"
          >
            Share your impact
          </button>
        </div>
      )}

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

      {/* Track existing report */}
      <div className="mx-4 mt-4">
        <button
          type="button"
          onClick={() => {
            void navigate('/lookup')
          }}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-xl border border-surface-200 shadow-sm active:bg-surface-50 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center shrink-0">
            <Search size={16} className="text-surface-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="m-0 text-sm font-semibold text-surface-900">Check report status</p>
            <p className="m-0 text-xs text-surface-400">Enter reference &amp; secret code</p>
          </div>
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
            <div className="mb-2 flex justify-center">
              <ClipboardList size={40} className="text-surface-400" />
            </div>
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
                void navigate('/')
              }}
            />
          ))
        )}
      </div>

      {/* Sign out */}
      <div className="mx-4 mt-5 pt-5 border-t border-surface-200 pb-2 flex justify-center">
        {signOutError && (
          <p role="alert" className="m-0 mb-2 text-xs text-danger-500">
            Sign out failed. Please try again.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            void handleSignOut()
          }}
          className="flex items-center gap-2 text-sm font-medium text-danger-500 bg-transparent border-none cursor-pointer p-0"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>

      {/* Bottom padding for nav bar */}
      <div className="h-8" />
    </div>
  )
}
