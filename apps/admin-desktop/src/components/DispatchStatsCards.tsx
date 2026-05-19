interface Props {
  activeCount: number
  stalledCount: number
  avgAcceptSeconds: number | null
  fcmSuccessRate: number
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString()}m ${s.toString()}s`
}

export function DispatchStatsCards({
  activeCount,
  stalledCount,
  avgAcceptSeconds,
  fcmSuccessRate,
}: Props) {
  const fcmPercent = Math.round(fcmSuccessRate * 100)
  const isFcmHigh = fcmSuccessRate >= 0.9

  return (
    <div className="flex gap-4">
      <div aria-label="Active Now" className="rounded-lg border-l-4 border-blue-400 bg-white/5 p-4">
        <div className="text-xs text-gray-400">Active Now</div>
        <div className="text-2xl font-bold text-white">{activeCount}</div>
      </div>

      <div
        aria-label="Stalled"
        className={`rounded-lg border-l-4 p-4 bg-white/5 ${stalledCount > 0 ? 'border-red-400' : 'border-gray-400'}`}
      >
        <div className="text-xs text-gray-400">Stalled</div>
        <div className="text-2xl font-bold text-white">{stalledCount}</div>
      </div>

      <div
        aria-label="Average accept time"
        className="rounded-lg border-l-4 border-gray-400 bg-white/5 p-4"
      >
        <div className="text-xs text-gray-400">Avg Accept</div>
        <div className="text-2xl font-bold text-white">
          {avgAcceptSeconds !== null ? formatSeconds(avgAcceptSeconds) : '—'}
        </div>
      </div>

      <div
        aria-label="FCM success rate"
        className={`rounded-lg border-l-4 p-4 bg-white/5 ${isFcmHigh ? 'text-green-400' : 'text-amber-400'}`}
      >
        <div className="text-xs">FCM Rate</div>
        <div className="text-2xl font-bold">{fcmPercent}%</div>
      </div>
    </div>
  )
}
