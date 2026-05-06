import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { useReport } from '../hooks/useReport'
import { AcceptanceCountdown } from '../components/AcceptanceCountdown'
import { reportTypeLabel } from '../lib/incident-labels'
import type { QueueDispatchRow } from '../lib/dispatch-presentation'
import styles from './DispatchListPage.module.css'

function statusLabel(uiStatus: string | undefined, fallback: string): string {
  if (uiStatus === 'heading_to_scene') return 'En Route'
  if (uiStatus === 'on_scene') return 'On Scene'
  return uiStatus ?? fallback
}

function DispatchCard({ row, variant }: { row: QueueDispatchRow; variant: 'pending' | 'active' }) {
  const { report } = useReport(row.reportId)
  const sevTone =
    report?.severity === 'high'
      ? styles.sevHigh
      : report?.severity === 'medium'
        ? styles.sevMedium
        : styles.sevLow

  return (
    <Link
      to={`/dispatches/${row.dispatchId}`}
      className={[styles.card, variant === 'pending' ? styles.cardPending : styles.cardActive]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          {report ? reportTypeLabel(report.reportType) : `Incident ${row.reportId.slice(0, 8)}`}
        </h3>
        <span
          className={[
            styles.statusPill,
            variant === 'pending' ? styles.pillPending : styles.pillActive,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {variant === 'pending' ? 'Pending' : statusLabel(row.uiStatus, row.status)}
        </span>
      </div>
      {report && (
        <div className={styles.cardChips}>
          <span className={[styles.severityChip, sevTone].filter(Boolean).join(' ')}>
            {report.severity}
          </span>
          <span className={styles.locationChip}>
            {report.municipalityLabel ?? report.municipalityId}
            {report.barangayId !== undefined ? ` · ${report.barangayId}` : ''}
          </span>
        </div>
      )}
      {variant === 'pending' && row.acknowledgementDeadlineAt && (
        <div className={styles.deadlineRow}>
          <span className={styles.deadlineLabel}>Accept by:</span>
          <AcceptanceCountdown deadlineMs={row.acknowledgementDeadlineAt.toMillis()} />
        </div>
      )}
      {variant === 'pending' && (
        <div className={styles.cardActions}>
          <span className={styles.btnPrimary}>View &amp; Accept</span>
        </div>
      )}
    </Link>
  )
}

export function DispatchListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { rows, groups, error } = useOwnDispatches(user?.uid)

  const activeDispatchId =
    groups.active.length === 1 ? (groups.active[0]?.dispatchId ?? null) : null

  useEffect(() => {
    if (activeDispatchId !== null) {
      void navigate(`/dispatches/${activeDispatchId}`, { replace: true })
    }
  }, [activeDispatchId, navigate])

  if (rows.length === 0 && error === null) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">
            ✓
          </div>
          <h2 className={styles.emptyTitle}>All Clear!</h2>
          <p className={styles.emptyText}>
            No active dispatches. Stay ready — new dispatches will appear here.
          </p>
          <Link to="/history" className={styles.emptyAction}>
            View Past Dispatches
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {error !== null && (
        <p role="alert" className={styles.errorBanner}>
          Failed to load dispatches: {error}
        </p>
      )}

      {groups.pending.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>New Dispatches ({String(groups.pending.length)})</h2>
          {groups.pending.map((row) => (
            <DispatchCard key={row.dispatchId} row={row} variant="pending" />
          ))}
        </section>
      )}

      {groups.active.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Active ({String(groups.active.length)})</h2>
          {groups.active.map((row) => (
            <DispatchCard key={row.dispatchId} row={row} variant="active" />
          ))}
        </section>
      )}
    </div>
  )
}
