import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { AcceptanceCountdown } from '../components/AcceptanceCountdown'
import styles from './DispatchListPage.module.css'

function statusLabel(uiStatus: string | undefined, fallback: string): string {
  if (uiStatus === 'heading_to_scene') return 'En Route'
  if (uiStatus === 'on_scene') return 'On Scene'
  return uiStatus ?? fallback
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
            <Link
              key={row.dispatchId}
              to={`/dispatches/${row.dispatchId}`}
              className={[styles.card, styles.cardPending].filter(Boolean).join(' ')}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Incident — New Dispatch</h3>
                <span className={[styles.statusPill, styles.pillPending].filter(Boolean).join(' ')}>
                  Pending
                </span>
              </div>
              <div className={styles.cardMeta}>
                <span>Report {row.reportId.slice(0, 8)}</span>
              </div>
              {row.acknowledgementDeadlineAt && (
                <div className={styles.deadlineRow}>
                  <span className={styles.deadlineLabel}>Accept by:</span>
                  <AcceptanceCountdown deadlineMs={row.acknowledgementDeadlineAt.toMillis()} />
                </div>
              )}
              <div className={styles.cardActions}>
                <span className={styles.btnPrimary}>View &amp; Accept</span>
              </div>
            </Link>
          ))}
        </section>
      )}

      {groups.active.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Active ({String(groups.active.length)})</h2>
          {groups.active.map((row) => (
            <Link
              key={row.dispatchId}
              to={`/dispatches/${row.dispatchId}`}
              className={[styles.card, styles.cardActive].filter(Boolean).join(' ')}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>Incident {row.reportId.slice(0, 8)}</h3>
                <span className={[styles.statusPill, styles.pillActive].filter(Boolean).join(' ')}>
                  {statusLabel(row.uiStatus, row.status)}
                </span>
              </div>
              <div className={styles.cardMeta}>
                <span>Tap to view details</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
