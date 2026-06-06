import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { useAuth } from '@bantayog/shared-ui'
import { auth } from '../app/firebase'
import { useResponderProfile } from '../hooks/useResponderProfile'
import { useResponderAvailability } from '../hooks/useResponderAvailability'
import type { ResponderAvailabilityStatus } from '../hooks/useResponderAvailability'
import { useDispatchHistory } from '../hooks/useDispatchHistory'
import { getResponderTypeLabel } from '../lib/incident-labels'
import styles from './ProfilePage.module.css'

const UNAVAILABLE_REASONS = ['On break', 'In meeting', 'On another call', 'Other']
const OFF_DUTY_REASONS = ['Shift ended', 'Sick leave', 'Training', 'Day off', 'Other']

type SettableStatus = Extract<ResponderAvailabilityStatus, 'available' | 'unavailable' | 'off_duty'>
type ResponderProfile = ReturnType<typeof useResponderProfile>['profile']
type DispatchHistoryRow = ReturnType<typeof useDispatchHistory>['history'][number]
interface ProfileStat {
  label: string
  value: string
  valueClassName?: string | undefined
}

const SETTABLE_STATUSES: ReadonlySet<string> = new Set(['available', 'unavailable', 'off_duty'])

const STATUS_SEGMENTS: { value: SettableStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'off_duty', label: 'Off Duty' },
]

function isSettableStatus(value: string): value is SettableStatus {
  return SETTABLE_STATUSES.has(value)
}

function statusBlurb(status: ResponderAvailabilityStatus | null): string {
  if (status === 'available') return 'Available for dispatch'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'off_duty') return 'Off Duty'
  if (status === 'on_break') return 'On Break'
  return 'Unknown'
}

function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return 'N/A'
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes).padStart(2, '0')}m`
  }

  return `${String(minutes)}m ${String(seconds).padStart(2, '0')}s`
}

function getSelectedStatus(
  selectedStatusOverride: SettableStatus | null,
  availStatus: ResponderAvailabilityStatus | null,
): SettableStatus {
  if (selectedStatusOverride !== null) return selectedStatusOverride
  return availStatus !== null && isSettableStatus(availStatus) ? availStatus : 'available'
}

function getReasonOptions(status: SettableStatus): string[] {
  return status === 'unavailable' ? UNAVAILABLE_REASONS : OFF_DUTY_REASONS
}

function getStatusDotClass(status: ResponderAvailabilityStatus | null): string | undefined {
  if (status === 'available') return styles.dotGreen
  if (status === 'unavailable') return styles.dotAmber
  if (status === 'off_duty') return styles.dotRed
  return styles.dotGray
}

function buildProfileStats(history: DispatchHistoryRow[], historyLoading: boolean): ProfileStat[] {
  const completedRows = history.filter((row) => row.status === 'resolved')
  const totalCount = history.length
  const resolvedCount = completedRows.length
  const completionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : null
  const responseDurations = completedRows
    .map((row) => (row.resolvedAt != null ? row.resolvedAt - row.dispatchedAt : null))
    .filter((ms): ms is number => ms !== null && ms >= 0)
  const avgResponseTime =
    responseDurations.length > 0
      ? Math.round(responseDurations.reduce((sum, ms) => sum + ms, 0) / responseDurations.length)
      : null
  const loadingEmptyHistory = historyLoading && history.length === 0

  return [
    {
      label: 'Total Dispatches',
      value: loadingEmptyHistory ? 'N/A' : String(totalCount),
      valueClassName: styles.statAmber,
    },
    {
      label: 'Resolution Rate',
      value: loadingEmptyHistory || completionRate === null ? 'N/A' : `${String(completionRate)}%`,
      valueClassName: styles.statGreen,
    },
    {
      label: 'Avg Response Time',
      value:
        loadingEmptyHistory || avgResponseTime === null ? 'N/A' : formatDuration(avgResponseTime),
    },
  ]
}

function ErrorBanner({
  label,
  message,
  onRetry,
}: {
  label: string
  message: string | null
  onRetry: () => void
}) {
  if (message === null) return null

  return (
    <div role="alert" className={styles.errorBanner}>
      {label}: {message}
      <button className={styles.retryBtn} onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

function ProfileIdentity({
  profile,
  profileLoading,
}: {
  profile: ResponderProfile
  profileLoading: boolean
}) {
  const responderTypeCode = profile?.responderType

  return (
    <div className={styles.identityRow}>
      {profileLoading ? (
        <h1 className={styles.profileName}>Loading profile...</h1>
      ) : (
        <h1 className={styles.profileName}>
          {profile?.displayName ?? auth.currentUser?.displayName ?? 'Responder'}
        </h1>
      )}
      {responderTypeCode !== undefined && (
        <p className={styles.profileTypeBadge}>
          <span>{responderTypeCode}</span>
          <span aria-hidden="true"> · </span>
          <span>{getResponderTypeLabel(responderTypeCode)}</span>
        </p>
      )}
    </div>
  )
}

function SpecializationsBlock({ specializations }: { specializations: string[] | undefined }) {
  const hasSpecializations = specializations !== undefined && specializations.length > 0

  return (
    <div className={styles.specializationsBlock}>
      <div className={styles.sectionHeader}>Specializations</div>
      {hasSpecializations ? (
        <div className={styles.chipList}>
          {specializations.map((specialization, index) => (
            <span
              key={specialization}
              className={[styles.chip, index === 0 ? styles.chipPrimary : styles.chipOutline]
                .filter(Boolean)
                .join(' ')}
            >
              {specialization}
            </span>
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>
          No specialization tags.{' '}
          <span className={styles.emptyStateHint}>Contact your agency admin</span> to add
          specializations.
        </p>
      )}
    </div>
  )
}

function AvailabilityPanel({
  availStatus,
  selectedStatus,
  reason,
  statusSaving,
  statusError,
  statusSuccess,
  availWriteError,
  onSegmentSelect,
  onReasonChange,
  onApplyStatus,
}: {
  availStatus: ResponderAvailabilityStatus | null
  selectedStatus: SettableStatus
  reason: string
  statusSaving: boolean
  statusError: string | null
  statusSuccess: boolean
  availWriteError: string | null
  onSegmentSelect: (status: SettableStatus) => void
  onReasonChange: (reason: string) => void
  onApplyStatus: () => void
}) {
  const showReason = selectedStatus !== 'available'

  return (
    <div className={styles.availabilityPanel}>
      <div className={styles.availabilityRow}>
        <span
          className={[styles.statusDot, getStatusDotClass(availStatus)].filter(Boolean).join(' ')}
          aria-hidden="true"
        />
        <span className={styles.statusLabel} aria-live="polite">
          {statusBlurb(availStatus)}
        </span>
      </div>
      <div className={styles.segmentedControl} role="group" aria-label="Set availability status">
        {STATUS_SEGMENTS.map((segment) => {
          const active = selectedStatus === segment.value
          return (
            <button
              key={segment.value}
              type="button"
              className={[styles.segmentBtn, active && styles.segmentBtnActive]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={active}
              onClick={() => {
                onSegmentSelect(segment.value)
              }}
            >
              {segment.label}
            </button>
          )
        })}
      </div>
      {showReason && (
        <select
          className={styles.reasonInput}
          value={reason}
          onChange={(event) => {
            onReasonChange(event.target.value)
          }}
          aria-label="Reason"
        >
          <option value="">Select reason...</option>
          {getReasonOptions(selectedStatus).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
      {statusError !== null && <p className={styles.errorMsg}>{statusError}</p>}
      {availWriteError !== null && <p className={styles.errorMsg}>{availWriteError}</p>}
      {statusSuccess && <p className={styles.successMsg}>Status updated.</p>}
      {showReason && (
        <button className={styles.updateBtn} onClick={onApplyStatus} disabled={statusSaving}>
          {statusSaving ? 'Saving...' : 'Apply Status'}
        </button>
      )}
    </div>
  )
}

function StatsRow({ stats }: { stats: ProfileStat[] }) {
  return (
    <div className={styles.statsRow}>
      {stats.map((stat, index) => (
        <Fragment key={stat.label}>
          {index > 0 && <div className={styles.statDivider} aria-hidden="true" />}
          <div className={styles.statItem}>
            <span className={[styles.statValue, stat.valueClassName].filter(Boolean).join(' ')}>
              {stat.value}
            </span>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  )
}

function ProfileCard({
  profile,
  profileLoading,
  availStatus,
  selectedStatus,
  reason,
  statusSaving,
  statusError,
  statusSuccess,
  availWriteError,
  stats,
  onSegmentSelect,
  onReasonChange,
  onApplyStatus,
}: {
  profile: ResponderProfile
  profileLoading: boolean
  availStatus: ResponderAvailabilityStatus | null
  selectedStatus: SettableStatus
  reason: string
  statusSaving: boolean
  statusError: string | null
  statusSuccess: boolean
  availWriteError: string | null
  stats: ProfileStat[]
  onSegmentSelect: (status: SettableStatus) => void
  onReasonChange: (reason: string) => void
  onApplyStatus: () => void
}) {
  return (
    <div className={styles.profileCard}>
      <div className={styles.avatar} aria-hidden="true">
        <User size={28} strokeWidth={2.2} />
      </div>
      <div className={styles.profileInfo}>
        <ProfileIdentity profile={profile} profileLoading={profileLoading} />
        <p className={styles.profileRole}>{profile?.stationLabel ?? 'Responder profile'}</p>
        <SpecializationsBlock specializations={profile?.specializations} />
        <AvailabilityPanel
          availStatus={availStatus}
          selectedStatus={selectedStatus}
          reason={reason}
          statusSaving={statusSaving}
          statusError={statusError}
          statusSuccess={statusSuccess}
          availWriteError={availWriteError}
          onSegmentSelect={onSegmentSelect}
          onReasonChange={onReasonChange}
          onApplyStatus={onApplyStatus}
        />
        <StatsRow stats={stats} />
      </div>
    </div>
  )
}

function ProfileActions({ onSignOut }: { onSignOut: () => void }) {
  return (
    <>
      <div className={styles.linkList}>
        <Link to="/history" className={styles.actionLink}>
          View Dispatch History
          <span aria-hidden="true">›</span>
        </Link>
      </div>
      <div className={styles.signOutDivider} aria-hidden="true" />
      <button className={styles.signOutBtn} onClick={onSignOut}>
        Sign Out
      </button>
    </>
  )
}

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useResponderProfile(user?.uid)
  const {
    status: availStatus,
    setAvailability,
    writeError: availWriteError,
  } = useResponderAvailability(user?.uid)
  const {
    history,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useDispatchHistory(user?.uid)

  const [selectedStatusOverride, setSelectedStatusOverride] = useState<SettableStatus | null>(null)
  const [reason, setReason] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusSuccess, setStatusSuccess] = useState(false)
  const selectedStatus = getSelectedStatus(selectedStatusOverride, availStatus)

  async function handleStatusUpdate(nextStatus: SettableStatus, nextReason?: string) {
    setStatusError(null)
    setStatusSuccess(false)
    if (nextStatus !== 'available' && !nextReason?.trim()) {
      setStatusError('Reason is required.')
      return
    }
    setStatusSaving(true)
    try {
      if (nextStatus === 'available') {
        await setAvailability('available')
      } else {
        await setAvailability(nextStatus, (nextReason ?? '').trim())
      }
      setSelectedStatusOverride(null)
      setReason('')
      setStatusSuccess(true)
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setStatusSaving(false)
    }
  }

  function handleSegmentSelect(nextStatus: SettableStatus) {
    setStatusError(null)
    setStatusSuccess(false)
    setReason('')
    if (nextStatus === 'available') {
      void handleStatusUpdate('available')
    } else {
      setSelectedStatusOverride(nextStatus)
    }
  }

  function handleSignOut() {
    if (!window.confirm('Are you sure you want to sign out?')) return
    void signOut().catch((err: unknown) => {
      console.error('[ProfilePage] sign out failed:', err)
    })
  }

  return (
    <div className={styles.page}>
      <ErrorBanner label="Could not load profile" message={profileError} onRetry={refetchProfile} />
      <ErrorBanner
        label="Could not load dispatch history"
        message={historyError}
        onRetry={refetchHistory}
      />
      <ProfileCard
        profile={profile}
        profileLoading={profileLoading}
        availStatus={availStatus}
        selectedStatus={selectedStatus}
        reason={reason}
        statusSaving={statusSaving}
        statusError={statusError}
        statusSuccess={statusSuccess}
        availWriteError={availWriteError}
        stats={buildProfileStats(history, historyLoading)}
        onSegmentSelect={handleSegmentSelect}
        onReasonChange={setReason}
        onApplyStatus={() => void handleStatusUpdate(selectedStatus, reason)}
      />
      <ProfileActions onSignOut={handleSignOut} />
    </div>
  )
}
