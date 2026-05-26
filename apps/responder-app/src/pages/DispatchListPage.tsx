import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { useAuth } from '@bantayog/shared-ui'
import { DispatchRing } from '../components/DispatchRing'
import { AcceptanceCountdown } from '../components/AcceptanceCountdown'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { useReport } from '../hooks/useReport'
import { getReportTypeLabel } from '../lib/incident-labels'
import {
  formatCountdownLabel,
  getDispatchProgress,
  getNextActionLabel,
} from '../lib/dispatch-progress'
import type { QueueDispatchRow } from '../lib/dispatch-presentation'
import styles from './DispatchListPage.module.css'

function statusLabel(uiStatus: string | undefined, fallback: string): string {
  if (uiStatus === 'heading_to_scene') return 'En Route'
  if (uiStatus === 'on_scene') return 'On Scene'
  return uiStatus ?? fallback
}

function resolveDeadlineMs(
  deadline: number | { toMillis: () => number } | undefined,
  fallbackNow: number,
): number {
  if (typeof deadline === 'number') return deadline
  return deadline?.toMillis() ?? fallbackNow
}

function DispatchCard({
  row,
  variant,
  now,
}: {
  row: QueueDispatchRow
  variant: 'pending' | 'active'
  now: number
}) {
  const navigate = useNavigate()
  const destination = `/dispatches/${row.dispatchId}`

  const { report, loading: reportLoading } = useReport(row.reportId)
  const sevTone =
    report?.severity === 'high'
      ? styles.sevHigh
      : report?.severity === 'medium'
        ? styles.sevMedium
        : styles.sevLow

  const title = report ? getReportTypeLabel(report.reportType) : 'Incident'
  const location = report
    ? (report.municipalityLabel ?? 'Unknown location') +
      (report.barangayId !== undefined ? ` · ${report.barangayId}` : '')
    : ''

  const deadlineMs = resolveDeadlineMs(row.acknowledgementDeadlineAt, now)
  const remainingMs = Math.max(0, deadlineMs - now)
  const remainingPercent = Math.max(0, Math.min(100, (remainingMs / (5 * 60 * 1000)) * 100))
  const urgent = remainingMs > 0 && remainingMs < 60_000
  const progress = getDispatchProgress(row.status)

  if (reportLoading) {
    return (
      <div
        data-testid={`dispatch-card-${row.dispatchId}-loading`}
        className={[
          styles.card,
          variant === 'pending' ? styles.cardPending : styles.cardActive,
          styles.skeleton,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ height: 200 }}
        aria-hidden="true"
      />
    )
  }

  return (
    <div
      data-testid={`dispatch-card-${row.dispatchId}`}
      className={[styles.card, variant === 'pending' ? styles.cardPending : styles.cardActive]
        .filter(Boolean)
        .join(' ')}
      tabIndex={0}
      role="button"
      aria-label={
        variant === 'pending'
          ? `${title} — pending acceptance`
          : `${title} — ${statusLabel(row.uiStatus, row.status)}`
      }
      onClick={(e) => {
        if (e.target instanceof HTMLButtonElement) return
        void navigate(destination)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          void navigate(destination)
        }
      }}
      data-destination={destination}
    >
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>
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
          <span className={styles.locationChip}>{location}</span>
        </div>
      )}

      {variant === 'pending' ? (
        <DispatchRing
          mode="countdown"
          percent={remainingPercent}
          tone={urgent ? 'urgent' : 'accent'}
          ariaLabel={formatCountdownLabel(remainingMs)}
          urgent={urgent}
        >
          <span className={styles.ringLabel}>ACCEPT IN</span>
          <AcceptanceCountdown deadlineMs={deadlineMs} nowMs={now} className={styles.ringNumber} />
          <h3 className={styles.ringTitle}>{title}</h3>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void navigate(destination)}
          >
            View &amp; Accept
          </button>
        </DispatchRing>
      ) : (
        <DispatchRing
          mode="progress"
          percent={progress}
          tone="success"
          ariaLabel={`Progress ${String(progress)} percent`}
        >
          <span className={styles.ringLabel}>PROGRESS</span>
          <strong className={styles.ringNumber}>{String(progress)}%</strong>
          <h3 className={styles.ringTitle}>{title}</h3>
          <button
            type="button"
            className={styles.btnSuccess}
            onClick={() => void navigate(destination)}
          >
            {getNextActionLabel(row.status)}
          </button>
        </DispatchRing>
      )}
    </div>
  )
}

export function DispatchListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { rows, groups, error, retry, loading } = useOwnDispatches(user?.uid)
  const [now, setNow] = useState(() => Date.now())

  const activeDispatchId =
    groups.active.length === 1 ? (groups.active[0]?.dispatchId ?? null) : null

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    if (activeDispatchId !== null) {
      void navigate(`/dispatches/${activeDispatchId}`, { replace: true })
    }
  }, [activeDispatchId, navigate])

  if (rows.length === 0 && error === null && !loading) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} role="img" aria-label="All dispatches complete">
            <CheckCircle size={48} strokeWidth={2} />
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
        <div role="alert" className={styles.errorBanner}>
          <p>Failed to load dispatches: {error}</p>{' '}
          <button type="button" className={styles.btnRetry} onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Loading…</h2>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              data-testid="skeleton"
              aria-hidden="true"
              className={[styles.card, styles.skeleton].filter(Boolean).join(' ')}
              style={{ height: 200 }}
            />
          ))}
        </div>
      )}

      {groups.pending.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>New Dispatches ({String(groups.pending.length)})</h2>
          {groups.pending.map((row) => (
            <DispatchCard key={row.dispatchId} row={row} variant="pending" now={now} />
          ))}
        </section>
      )}

      {groups.active.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Active ({String(groups.active.length)})</h2>
          {groups.active.map((row) => (
            <DispatchCard key={row.dispatchId} row={row} variant="active" now={now} />
          ))}
        </section>
      )}
    </div>
  )
}
