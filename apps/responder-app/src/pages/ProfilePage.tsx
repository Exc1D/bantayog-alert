import { useState } from 'react'
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

const SETTABLE_STATUSES: ReadonlySet<string> = new Set(['available', 'unavailable', 'off_duty'])

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

const STATUS_SEGMENTS: { value: SettableStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'off_duty', label: 'Off Duty' },
]

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
  const selectedStatus =
    selectedStatusOverride ??
    (availStatus !== null && isSettableStatus(availStatus) ? availStatus : 'available')
  const [reason, setReason] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusSuccess, setStatusSuccess] = useState(false)

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

  const dotClass =
    availStatus === 'available'
      ? styles.dotGreen
      : availStatus === 'unavailable'
        ? styles.dotAmber
        : availStatus === 'off_duty'
          ? styles.dotRed
          : styles.dotGray

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
      setSelectedStatusOverride(null) // Clear override to follow availStatus
      setReason('')
      setStatusSuccess(true)
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setStatusSaving(false)
    }
  }

  const reasonOptions = selectedStatus === 'unavailable' ? UNAVAILABLE_REASONS : OFF_DUTY_REASONS
  const profileTypeLabel = getResponderTypeLabel(profile?.responderType)
  const responderTypeCode = profile?.responderType
  const specializations = profile?.specializations

  return (
    <div className={styles.page}>
      {profileError !== null && (
        <div role="alert" className={styles.errorBanner}>
          Could not load profile: {profileError}
          <button className={styles.retryBtn} onClick={refetchProfile}>
            Retry
          </button>
        </div>
      )}

      {historyError !== null && (
        <div role="alert" className={styles.errorBanner}>
          Could not load dispatch history: {historyError}
          <button className={styles.retryBtn} onClick={refetchHistory}>
            Retry
          </button>
        </div>
      )}

      <div className={styles.profileCard}>
        <div className={styles.avatar} aria-hidden="true">
          <User size={28} strokeWidth={2.2} />
        </div>
        <div className={styles.profileInfo}>
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
                <span>{profileTypeLabel}</span>
              </p>
            )}
          </div>
          <p className={styles.profileRole}>{profile?.stationLabel ?? 'Responder profile'}</p>

          <div className={styles.specializationsBlock}>
            <div className={styles.sectionHeader}>Specializations</div>
            {specializations !== undefined && specializations.length > 0 ? (
              <div className={styles.chipList}>
                {specializations.map((s, index) => (
                  <span
                    key={s}
                    className={[styles.chip, index === 0 ? styles.chipPrimary : styles.chipOutline]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {s}
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

          <div className={styles.availabilityPanel}>
            <div className={styles.availabilityRow}>
              <span
                className={[styles.statusDot, dotClass].filter(Boolean).join(' ')}
                aria-hidden="true"
              />
              <span className={styles.statusLabel} aria-live="polite">
                {statusBlurb(availStatus)}
              </span>
            </div>
            <div
              className={styles.segmentedControl}
              role="group"
              aria-label="Set availability status"
            >
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
                      setStatusError(null)
                      setStatusSuccess(false)
                      if (segment.value === 'available') {
                        setReason('')
                        void handleStatusUpdate('available')
                      } else {
                        setSelectedStatusOverride(segment.value)
                        setReason('')
                      }
                    }}
                  >
                    {segment.label}
                  </button>
                )
              })}
            </div>
            {selectedStatus !== 'available' && (
              <select
                className={styles.reasonInput}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                }}
                aria-label="Reason"
              >
                <option value="">Select reason...</option>
                {reasonOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
            {statusError !== null && <p className={styles.errorMsg}>{statusError}</p>}
            {availWriteError !== null && <p className={styles.errorMsg}>{availWriteError}</p>}
            {statusSuccess && <p className={styles.successMsg}>Status updated.</p>}
            {selectedStatus !== 'available' && (
              <button
                className={styles.updateBtn}
                onClick={() => void handleStatusUpdate(selectedStatus, reason)}
                disabled={statusSaving}
              >
                {statusSaving ? 'Saving...' : 'Apply Status'}
              </button>
            )}
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={[styles.statValue, styles.statAmber].join(' ')}>
                {historyLoading && history.length === 0 ? 'N/A' : String(totalCount)}
              </span>
              <span className={styles.statLabel}>Total Dispatches</span>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.statItem}>
              <span className={[styles.statValue, styles.statGreen].join(' ')}>
                {historyLoading && history.length === 0
                  ? 'N/A'
                  : completionRate !== null
                    ? `${String(completionRate)}%`
                    : 'N/A'}
              </span>
              <span className={styles.statLabel}>Resolution Rate</span>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.statItem}>
              <span className={styles.statValue}>
                {historyLoading && history.length === 0
                  ? 'N/A'
                  : avgResponseTime !== null
                    ? formatDuration(avgResponseTime)
                    : 'N/A'}
              </span>
              <span className={styles.statLabel}>Avg Response Time</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.linkList}>
        <Link to="/history" className={styles.actionLink}>
          View Dispatch History
          <span aria-hidden="true">›</span>
        </Link>
      </div>

      <div className={styles.signOutDivider} aria-hidden="true" />

      <button
        className={styles.signOutBtn}
        onClick={() => {
          if (!window.confirm('Are you sure you want to sign out?')) return
          void signOut().catch((err: unknown) => {
            console.error('[ProfilePage] sign out failed:', err)
          })
        }}
      >
        Sign Out
      </button>
    </div>
  )
}
