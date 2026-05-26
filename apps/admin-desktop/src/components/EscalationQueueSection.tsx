import { AlertTriangle } from 'lucide-react'
import type { DashboardMode } from '../utils/dashboard-mode'

interface StalledDispatch {
  dispatchId: string
  reportId: string
  responderName: string
  escalationCount: number
}

interface Props {
  stalledDispatches: StalledDispatch[]
  onReDispatch: (dispatchId: string) => void
  mode: DashboardMode
}

export function EscalationQueueSection({ stalledDispatches, onReDispatch, mode }: Props) {
  if (mode === 'calm' || stalledDispatches.length === 0) {
    if (mode === 'calm') return null
    return (
      <div className="rounded border border-[var(--color-success)]/20 bg-[var(--color-success)]/5 px-4 py-2">
        <span className="text-sm text-[var(--color-success)]">All clear — no stalled dispatches</span>
      </div>
    )
  }

  return (
    <section
      aria-label="Escalation queue"
      className="border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 rounded-lg p-4 space-y-3"
    >
      <h2 className="flex items-center gap-2 text-[var(--color-danger)] font-semibold text-sm uppercase tracking-wide">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Needs Admin Attention ({stalledDispatches.length})
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {stalledDispatches.map((d) => (
          <div
            key={d.dispatchId}
            className="min-w-[220px] rounded-md border border-[var(--color-danger)]/20 bg-[var(--color-surface-elevated)] p-3 space-y-1"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--color-text-muted)]">Report ID</div>
              <a
                href={`/dispatches?highlight=${encodeURIComponent(d.dispatchId)}`}
                className="text-xs text-[var(--color-carto-blue)] hover:underline"
              >
                View Details
              </a>
            </div>
            <div className="text-sm font-mono text-[var(--color-text-primary)]">{d.reportId.slice(0, 8)}</div>

            <div className="text-xs text-[var(--color-text-muted)]">Assigned to: {d.responderName}</div>

            <div className="text-xs text-[var(--color-warning)]">Escalated {d.escalationCount}x</div>

            <button
              type="button"
              aria-label={`Re-dispatch ${d.dispatchId}`}
              onClick={() => {
                onReDispatch(d.dispatchId)
              }}
              className="mt-2 w-full rounded bg-[var(--color-danger)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]"
            >
              Re-dispatch
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
