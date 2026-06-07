import { TrendingUp, CheckCircle } from 'lucide-react'
import type { MyReport } from '../../MapTab/types.js'

interface MilestoneTrackerProps {
  reports: MyReport[]
}

function impactGuidance(counts: {
  sent: number
  review: number
  verified: number
  resolved: number
}): string {
  if (counts.resolved > 0) return 'Response loop complete. Keep the reference for your records.'
  if (counts.verified > 0)
    return 'Verified signal. Watch for responder updates before sending duplicates.'
  if (counts.review > 0)
    return 'Under review. Keep your phone nearby in case responders need details.'
  return 'Report sent. Keep the reference code ready until it is verified.'
}

export function MilestoneTracker({ reports }: MilestoneTrackerProps) {
  const counts = {
    sent: reports.length,
    review: reports.filter((r) => r.status === 'awaiting_verify').length,
    verified: reports.filter((r) => r.status === 'verified').length,
    resolved: reports.filter((r) => r.status === 'resolved' || r.status === 'closed').length,
  }

  const data = [
    { label: 'Report sent', count: counts.sent },
    { label: 'Under review', count: counts.review },
    { label: 'Verified', count: counts.verified },
    { label: 'Resolved', count: counts.resolved },
  ]
  const activeSignals = data.filter((m) => m.count > 0).length
  const guidance = impactGuidance(counts)

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4 mx-4 mt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-500" />
          <h2 className="text-sm font-semibold text-surface-700">Impact Path</h2>
        </div>
        <span className="text-[10px] font-bold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-1 rounded-full">
          {activeSignals}/4 signals
        </span>
      </div>
      <div className="flex gap-2">
        {data.map((m, i) => {
          const isActive = m.count > 0
          const isLast = i === data.length - 1
          return (
            <div key={m.label} className="flex-1 flex items-center gap-2">
              <div className="flex-1">
                <div
                  className={`h-2 rounded-full transition-colors ${isActive ? 'bg-brand-500' : 'bg-surface-200'}`}
                />
                <p
                  className={`text-[10px] mt-1.5 text-center font-medium ${isActive ? 'text-surface-700' : 'text-surface-400'}`}
                >
                  {m.label}
                </p>
                {isActive && (
                  <p className="text-[10px] text-center text-brand-500 font-semibold">{m.count}</p>
                )}
              </div>
              {!isLast && (
                <div className={`w-3 h-px ${isActive ? 'bg-brand-500' : 'bg-surface-200'}`} />
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-100 px-3 py-2">
        <CheckCircle size={14} className="text-brand-500 shrink-0 mt-0.5" />
        <p className="m-0 text-xs leading-relaxed text-surface-600">{guidance}</p>
      </div>
    </div>
  )
}
