import { Link, useNavigate } from 'react-router-dom'
import { useReport } from '../hooks/useReport'
import { getReportTypeLabel } from '../lib/incident-labels'
import { formatCountdownLabel, getNextActionLabel } from '../lib/dispatch-progress'
import type { QueueDispatchRow } from '../lib/dispatch-presentation'
import styles from './DispatchRow.module.css'

interface Props {
  row: QueueDispatchRow
  now: number
}

function resolveDeadlineMs(
  deadline: number | { toMillis: () => number } | undefined,
  fallbackNow: number,
): number {
  if (typeof deadline === 'number') return deadline
  return deadline?.toMillis() ?? fallbackNow
}

export function DispatchRow({ row, now }: Props) {
  const navigate = useNavigate()
  const { report } = useReport(row.reportId)

  const deadlineMs = resolveDeadlineMs(row.acknowledgementDeadlineAt, now)
  const remainingMs = Math.max(0, deadlineMs - now)
  const urgent = remainingMs > 0 && remainingMs < 60_000

  const title = report ? getReportTypeLabel(report.reportType) : 'Incident'

  const sevClass =
    report?.severity === 'high'
      ? styles.sevHigh
      : report?.severity === 'medium'
        ? styles.sevMedium
        : report?.severity === 'low'
          ? styles.sevLow
          : ''

  return (
    <div
      className={[
        styles.row,
        row.status === 'pending' ? styles.pending : styles.active,
        urgent ? styles.urgentRow : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="button"
      tabIndex={0}
      aria-label={`${title} — ${row.status}`}
      onClick={() => {
        void navigate(`/dispatches/${row.dispatchId}`)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          void navigate(`/dispatches/${row.dispatchId}`)
        }
      }}
    >
      <div className={styles.meta}>
        <span className={styles.type}>{title}</span>
        {report?.severity != null && (
          <span className={[styles.severity, sevClass].filter(Boolean).join(' ')}>
            {report.severity}
          </span>
        )}
      </div>
      {row.status === 'pending' ? (
        <span
          className={[styles.countdown, urgent && styles.urgentText].filter(Boolean).join(' ')}
          aria-label={formatCountdownLabel(remainingMs)}
        >
          {remainingMs <= 0 ? 'Expired' : `${String(Math.ceil(remainingMs / 1000))}s`}
        </span>
      ) : (
        <span className={styles.statusText}>{row.uiStatus ?? row.status}</span>
      )}
      <Link
        to={`/dispatches/${row.dispatchId}`}
        className={styles.actionBtn}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {row.status === 'pending' ? 'Accept' : getNextActionLabel(row.status)}
      </Link>
    </div>
  )
}
