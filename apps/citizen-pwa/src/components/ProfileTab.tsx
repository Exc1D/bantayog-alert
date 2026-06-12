import { useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Search,
  Settings,
  User as UserIcon,
  Award,
  ShieldCheck,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { DeleteSheet } from './DeleteSheet.js'
import { incidentLabel } from '../utils/incident-meta.js'
import type { ReportStatus } from '@bantayog/shared-types'
import { useProfileTab } from './ProfileTab/useProfileTab.js'
import { MilestoneTracker } from './ProfileTab/components/MilestoneTracker.js'
import { BadgeList } from './ProfileTab/components/BadgeList.js'
import { ReportCard } from './ProfileTab/components/ReportCard.js'

export const WITHDRAWABLE_STATUSES = new Set<ReportStatus | 'queued'>([
  'queued',
  'new',
  'awaiting_verify',
])

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

import { CheckCircle } from 'lucide-react'

/* ── Main component ── */
export function ProfileTab() {
  const navigate = useNavigate()
  const {
    user,
    authLoading,
    reports,
    loading,
    reportsError,
    retryReports,
    withdrawReport,
    signOutError,
    daysAsGuardian,
    isPseudonymous,
    isRegistered,
    initials,
    verifiedCount,
    resolvedCount,
    uniqueAreas,
    badges,
    setWithdrawReport,
    handleSignOut,
    handleShare,
    handleWithdrawReport,
  } = useProfileTab()

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
            {/* Badge previews locked */}
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

      {/* Lifecycle feedback stays ahead of rewards so citizens see real response progress first. */}
      {reports.length > 0 && <MilestoneTracker reports={reports} />}

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
            {uniqueAreas > 0 ? uniqueAreas : 'N/A'}
          </p>
          <p className="m-0 text-xs text-surface-500 mt-0.5">Areas Helped</p>
        </div>
      </div>

      {/* Badges — always visible for motivational progress */}
      <BadgeList badges={badges} />

      {/* Share prompt */}
      {reports.length > 0 && (
        <div className="mx-4 mt-4 bg-brand-50 rounded-xl border border-brand-200 p-4">
          <p className="m-0 text-sm font-semibold text-surface-900 mb-1">
            You&apos;ve helped your community {reports.length}{' '}
            {reports.length === 1 ? 'time' : 'times'}
          </p>
          <p className="m-0 text-xs text-surface-500 mb-3">
            Share that you&apos;re making a difference. Ibahin ang iyong kontribusyon.
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
        ) : reportsError && reports.length === 0 ? (
          <div
            role="alert"
            className="rounded-xl border border-danger-200 bg-white px-4 py-6 text-center shadow-sm"
          >
            <div className="mb-2 flex justify-center">
              <ClipboardList size={40} className="text-danger-500" />
            </div>
            <p className="m-0 mb-1.5 font-bold text-surface-900 text-[0.9375rem]">{reportsError}</p>
            <p className="m-0 mb-4 text-[0.8125rem] text-surface-500">
              Your saved reports are still on this device. Try again when the connection settles.
            </p>
            <button type="button" className="btn btn--primary" onClick={retryReports}>
              Retry
            </button>
          </div>
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
          <>
            {reportsError && (
              <div
                role="status"
                className="mb-3 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-3"
              >
                <p className="m-0 text-sm font-semibold text-surface-900">Showing saved reports</p>
                <p className="m-0 mt-1 text-xs text-surface-600">
                  We can&apos;t refresh your report status right now.
                </p>
                <button
                  type="button"
                  className="mt-3 text-xs font-semibold text-brand-600 border border-brand-300 bg-white rounded-lg px-3 py-2 active:bg-brand-50 transition-colors cursor-pointer"
                  onClick={retryReports}
                >
                  Retry
                </button>
              </div>
            )}
            {reports.map((report) => (
              <ReportCard
                key={report.publicRef}
                report={report}
                onTap={() => {
                  void navigate('/')
                }}
                {...(WITHDRAWABLE_STATUSES.has(report.status)
                  ? {
                      onWithdraw: () => {
                        setWithdrawReport(report)
                      },
                    }
                  : {})}
              />
            ))}
          </>
        )}
      </div>

      <DeleteSheet
        open={withdrawReport !== null}
        publicRef={withdrawReport?.publicRef ?? ''}
        reportType={withdrawReport ? incidentLabel(withdrawReport.reportType) : ''}
        onConfirm={() => {
          if (withdrawReport) void handleWithdrawReport(withdrawReport)
        }}
        onCancel={() => {
          setWithdrawReport(null)
        }}
      />

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
