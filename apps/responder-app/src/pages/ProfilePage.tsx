import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { User } from 'lucide-react'
import { useAuth } from '@bantayog/shared-ui'
import { auth, db } from '../app/firebase'
import { useResponderProfile } from '../hooks/useResponderProfile'
import { useResponderAvailability } from '../hooks/useResponderAvailability'
import type { ResponderAvailabilityStatus } from '../hooks/useResponderAvailability'
import { useDispatchHistory } from '../hooks/useDispatchHistory'
import { getReportTypeLabel, getResponderTypeLabel } from '../lib/incident-labels'
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
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—'
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes).padStart(2, '0')}m`
  }

  return `${String(minutes)}m ${String(seconds).padStart(2, '0')}s`
}

function getWeekBucket(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const offset = (day + 6) % 7
  date.setDate(date.getDate() - offset)
  return date.getTime()
}

function getToneClass(ratio: number, stylesMap: typeof styles): string {
  if (ratio >= 0.8) return stylesMap.masteryGreen ?? ''
  if (ratio >= 0.5) return stylesMap.masteryAmber ?? ''
  return stylesMap.masteryMuted ?? ''
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
  const [reportTypesById, setReportTypesById] = useState<Record<string, string>>({})
  const reportIdsKey = history.map((row) => row.reportId).join('|')
  const [loadedReportIdsKey, setLoadedReportIdsKey] = useState('')
  const reportTypesLoaded = loadedReportIdsKey === reportIdsKey

  useEffect(() => {
    let active = true
    const reportIds = Array.from(new Set(history.map((row) => row.reportId)))

    if (reportIds.length === 0) {
      return () => {
        active = false
      }
    }

    void Promise.all(
      reportIds.map(async (reportId) => {
        const snap = await getDoc(doc(db, 'reports', reportId))
        if (!snap.exists()) return null
        const data = snap.data()
        return [reportId, String(data.reportType ?? 'other')] as const
      }),
    )
      .then((pairs) => {
        if (!active) return
        const next: Record<string, string> = {}
        for (const pair of pairs) {
          if (pair === null) continue
          next[pair[0]] = pair[1]
        }
        setReportTypesById(next)
        setLoadedReportIdsKey(reportIdsKey)
      })
      .catch((err: unknown) => {
        if (!active) return
        console.error('[ProfilePage] report insight load failed:', err)
        setReportTypesById({})
        setLoadedReportIdsKey(reportIdsKey)
      })

    return () => {
      active = false
    }
  }, [history, reportIdsKey])

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
  const fastestResponseTime = responseDurations.length > 0 ? Math.min(...responseDurations) : null
  const mostDispatchesInWeek = Object.values(
    history.reduce<Record<number, number>>((acc, row) => {
      const bucket = getWeekBucket(row.dispatchedAt)
      acc[bucket] = (acc[bucket] ?? 0) + 1
      return acc
    }, {}),
  ).reduce((max, count) => Math.max(max, count), 0)

  const reportTypeLookup = reportTypesLoaded ? reportTypesById : {}
  const resolvedTypeCounts = completedRows.reduce<Record<string, number>>((acc, row) => {
    const type = reportTypeLookup[row.reportId] ?? 'other'
    acc[type] = (acc[type] ?? 0) + 1
    return acc
  }, {})
  const masterySourceRows = Object.entries(resolvedTypeCounts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return getReportTypeLabel(a[0]).localeCompare(getReportTypeLabel(b[0]))
  })
  const maxMasteryCount = masterySourceRows[0]?.[1] ?? 0
  const countByType = new Map(masterySourceRows.map(([type, count]) => [type, count]))
  const masteryRows =
    profile?.specializations != null && profile.specializations.length > 0
      ? profile.specializations.map((label) => {
          const matchingType =
            masterySourceRows.find(([type]) => getReportTypeLabel(type) === label)?.[0] ?? null
          return {
            label,
            count: matchingType !== null ? (countByType.get(matchingType) ?? 0) : 0,
          }
        })
      : masterySourceRows.map(([type, count]) => ({
          label: getReportTypeLabel(type),
          count,
        }))

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
  const responderTypeCode = profile?.responderType
  const specializations = profile?.specializations

  return (
    <div className={styles.page}>
      <div className={styles.profileCard}>
        <div className={styles.avatar} aria-hidden="true">
          <User size={28} strokeWidth={2.2} />
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.identityRow}>
            <h1 className={styles.profileName}>
              {profile?.displayName ?? auth.currentUser?.displayName ?? 'Responder'}
            </h1>
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

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={[styles.statValue, styles.statAmber].join(' ')}>
                {String(totalCount)}
              </span>
              <span className={styles.statLabel}>Total Dispatches</span>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.statItem}>
              <span className={[styles.statValue, styles.statGreen].join(' ')}>
                {completionRate !== null ? `${String(completionRate)}%` : '—'}
              </span>
              <span className={styles.statLabel}>Resolution Rate</span>
            </div>
            <div className={styles.statDivider} aria-hidden="true" />
            <div className={styles.statItem}>
              <span className={styles.statValue}>
                {avgResponseTime !== null ? formatDuration(avgResponseTime) : '—'}
              </span>
              <span className={styles.statLabel}>Avg Response Time</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>Specialization Mastery</div>
        <div className={styles.sectionBody}>
          {reportTypesLoaded && masteryRows.length > 0 ? (
            <div className={styles.masteryList}>
              {masteryRows.map((row) => {
                const ratio = maxMasteryCount > 0 ? row.count / maxMasteryCount : 0
                return (
                  <div key={row.label} className={styles.masteryRow}>
                    <div className={styles.masteryMeta}>
                      <span className={styles.masteryLabel}>{row.label}</span>
                      <span className={styles.masteryCount}>{String(row.count)} resolved</span>
                    </div>
                    <div className={styles.masteryTrack} aria-hidden="true">
                      <div
                        className={[styles.masteryFill, getToneClass(ratio, styles)]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ width: `${String(ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className={styles.emptyState}>
              {!reportTypesLoaded && history.length > 0
                ? 'Loading mastery data…'
                : 'No recent resolved dispatches yet.'}
            </p>
          )}
          <p className={styles.sectionNote}>
            Mastery uses recent resolved dispatch types and fills relative to the strongest bucket.
          </p>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>Personal Bests</div>
        <div className={styles.sectionBody}>
          <div className={styles.recordList}>
            <div className={styles.recordRow}>
              <span className={styles.recordLabel}>Fastest response</span>
              <span className={styles.recordValue}>
                {fastestResponseTime !== null ? formatDuration(fastestResponseTime) : '—'}
              </span>
            </div>
            <div className={styles.recordRow}>
              <span className={styles.recordLabel}>Most dispatches in a week</span>
              <span className={styles.recordValue}>
                {mostDispatchesInWeek > 0 ? `${String(mostDispatchesInWeek)} dispatches` : '—'}
              </span>
            </div>
            <div className={styles.recordRow}>
              <span className={styles.recordLabel}>Longest availability streak</span>
              <span className={styles.recordValue}>Not tracked yet</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.availabilityPanel}>
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
              const val = e.target.value
              setSelectedStatus(isSettableStatus(val) ? val : 'available')
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

      <div className={styles.linkList}>
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
