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
      <div className="rounded border border-green-500/20 bg-green-500/5 px-4 py-2">
        <span className="text-sm text-green-400">All clear — no stalled dispatches</span>
      </div>
    )
  }

  return (
    <section
      aria-label="Escalation queue"
      className="border border-red-500/30 bg-red-500/5 rounded-lg p-4 space-y-3"
    >
      <h2 className="flex items-center gap-2 text-red-400 font-semibold text-sm uppercase tracking-wide">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Needs Admin Attention ({stalledDispatches.length})
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {stalledDispatches.map((d) => (
          <div
            key={d.dispatchId}
            className="min-w-[220px] rounded-md border border-red-500/20 bg-gray-900/40 p-3 space-y-1"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-400">Report ID</div>
              <a
                href={`/dispatches?highlight=${encodeURIComponent(d.dispatchId)}`}
                className="text-xs text-blue-400 hover:underline"
              >
                View Details
              </a>
            </div>
            <div className="text-sm font-mono text-white">{d.reportId.slice(0, 8)}</div>

            <div className="text-xs text-gray-400">Assigned to: {d.responderName}</div>

            <div className="text-xs text-amber-500">Escalated {d.escalationCount}x</div>

            <button
              type="button"
              aria-label={`Re-dispatch ${d.dispatchId}`}
              onClick={() => {
                onReDispatch(d.dispatchId)
              }}
              className="mt-2 w-full rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Re-dispatch
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
