import { useState } from 'react'
import { Link } from 'react-router-dom'
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

function statusBlurb(status: ResponderAvailabilityStatus | null): string {
  if (status === 'available') return 'Available for dispatch'
  if (status === 'unavailable') return 'Unavailable'
  if (status === 'off_duty') return 'Off Duty'
  if (status === 'on_break') return 'On Break'
  return 'Unknown'
}

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const { profile } = useResponderProfile(user?.uid)
  const {
    status: availStatus,
    setAvailability,
    writeError: availWriteError,
  } = useResponderAvailability(user?.uid)
  const { history } = useDispatchHistory(user?.uid)

  const [selectedStatus, setSelectedStatus] = useState<SettableStatus>('available')
  const [reason, setReason] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const resolvedCount = history.filter((h) => h.status === 'resolved').length
  const totalCount = history.length

  const dotClass =
    availStatus === 'available'
      ? styles.dotGreen
      : availStatus === 'unavailable'
        ? styles.dotAmber
        : availStatus === 'off_duty'
          ? styles.dotRed
          : styles.dotGray

  async function handleStatusUpdate() {
    setStatusError(null)
    if (selectedStatus !== 'available' && !reason.trim()) {
      setStatusError('Reason is required.')
      return
    }
    setStatusSaving(true)
    try {
      if (selectedStatus === 'available') {
        await setAvailability('available')
      } else {
        await setAvailability(selectedStatus, reason.trim())
      }
      setReason('')
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setStatusSaving(false)
    }
  }

  const reasonOptions = selectedStatus === 'unavailable' ? UNAVAILABLE_REASONS : OFF_DUTY_REASONS
  const profileTypeLabel = getResponderTypeLabel(profile?.responderType)

  return (
    <div className={styles.page}>
      <div className={styles.profileCard}>
        <div className={styles.avatar} aria-hidden="true">
          👤
        </div>
        <div className={styles.profileInfo}>
          <h1 className={styles.profileName}>
            {profile?.displayName ?? auth.currentUser?.displayName ?? 'Responder'}
          </h1>
          <p className={styles.profileRole}>
            {profileTypeLabel} Responder
            {profile?.stationLabel !== undefined ? ` · ${profile.stationLabel}` : ''}
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>Availability</div>
        <div className={styles.sectionBody}>
          <div className={styles.availabilityRow}>
            <span
              className={[styles.statusDot, dotClass].filter(Boolean).join(' ')}
              aria-hidden="true"
            />
            <span className={styles.statusLabel}>{statusBlurb(availStatus)}</span>
            <select
              className={styles.statusSelect}
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as SettableStatus)
                setReason('')
              }}
              aria-label="Set availability status"
            >
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="off_duty">Off Duty</option>
            </select>
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
              <option value="">Select reason…</option>
              {reasonOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
          {statusError !== null && <p className={styles.errorMsg}>{statusError}</p>}
          {availWriteError !== null && <p className={styles.errorMsg}>{availWriteError}</p>}
          <button
            className={styles.updateBtn}
            onClick={() => void handleStatusUpdate()}
            disabled={statusSaving}
          >
            {statusSaving ? 'Saving…' : 'Update Status'}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>Your Performance (Recent)</div>
        <div className={styles.sectionBody}>
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statValue}>{String(totalCount)}</span>
              <span className={styles.statLabel}>Recent Dispatches</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>{String(resolvedCount)}</span>
              <span className={styles.statLabel}>Resolved</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statValue}>
                {totalCount > 0
                  ? `${String(Math.round((resolvedCount / totalCount) * 100))}%`
                  : '—'}
              </span>
              <span className={styles.statLabel}>Completion Rate</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <Link to="/history" className={styles.actionLink}>
          View Dispatch History
          <span aria-hidden="true">›</span>
        </Link>
        <Link to="/handoff" className={styles.actionLink}>
          Start Shift Handoff
          <span aria-hidden="true">›</span>
        </Link>
      </div>

      <button
        className={styles.signOutBtn}
        onClick={() =>
          void signOut().catch((err: unknown) => {
            console.error('[ProfilePage] sign out failed:', err)
          })
        }
      >
        Sign Out
      </button>
    </div>
  )
}
