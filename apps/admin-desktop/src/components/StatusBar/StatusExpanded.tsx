import { formatSeconds } from './format-utils'

interface StatusExpandedProps {
  resolvedToday: number | undefined
  muniIssues: { resolved: number; total: number } | undefined
  stalledDispatchCount: number
  fcmSuccessRate: number | null
  avgAcceptSeconds: number | null
  isSurge: boolean
}

export function StatusExpanded({
  resolvedToday,
  muniIssues,
  stalledDispatchCount,
  fcmSuccessRate,
  avgAcceptSeconds,
  isSurge,
}: StatusExpandedProps) {
  const fcmPercent = fcmSuccessRate !== null ? Math.round(fcmSuccessRate * 100) : null
  const isFcmHigh = fcmSuccessRate !== null && fcmSuccessRate >= 0.9

  return (
    <div className="flex justify-around border-t border-white/10 px-4 py-2 text-sm text-[var(--color-text-secondary)]">
      <span>
        Resolved:{' '}
        <strong data-testid="statusbar-resolved-today" className="text-[var(--color-text-primary)]">
          {resolvedToday === undefined ? '—' : String(resolvedToday)}
        </strong>
      </span>
      <span>
        Muni Issues:{' '}
        <strong data-testid="statusbar-muni-issues" className="text-[var(--color-text-primary)]">
          {muniIssues ? `${String(muniIssues.resolved)}/${String(muniIssues.total)}` : '—'}
        </strong>
      </span>
      <span>
        Stalled:{' '}
        <strong
          data-testid="statusbar-stalled"
          className={
            stalledDispatchCount > 0
              ? 'text-[var(--color-danger)]'
              : 'text-[var(--color-text-primary)]'
          }
        >
          {String(stalledDispatchCount)}
        </strong>
      </span>
      <span>
        Push Rate:{' '}
        <strong
          data-testid="statusbar-fcm-rate"
          className={
            fcmPercent !== null
              ? isFcmHigh
                ? 'text-[var(--color-success)]'
                : 'text-[var(--color-warning)]'
              : 'text-[var(--color-text-muted)]'
          }
        >
          {fcmPercent !== null ? `${String(fcmPercent)}%` : '—'}
        </strong>
      </span>
      <span>
        Avg Response:{' '}
        <strong data-testid="statusbar-avg-accept" className="text-[var(--color-text-primary)]">
          {avgAcceptSeconds !== null ? formatSeconds(avgAcceptSeconds) : '—'}
        </strong>
      </span>
      <span>
        Surge:{' '}
        <strong className="text-[var(--color-text-primary)]">{isSurge ? 'Active' : 'Idle'}</strong>
      </span>
    </div>
  )
}
