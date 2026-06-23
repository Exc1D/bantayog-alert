import type { DashboardMode } from '../utils/dashboard-mode'

interface Props {
  activeCount: number
  stalledCount: number
  avgAcceptSeconds: number | null
  fcmSuccessRate: number | null
  mode: DashboardMode
}

type MetricStatus = 'OK' | 'Watch' | 'Action required' | 'Unavailable'

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes)}m ${String(seconds)}s`
}

function getActiveStatus(activeCount: number): MetricStatus {
  if (activeCount > 20) return 'Action required'
  if (activeCount > 0) return 'Watch'
  return 'OK'
}

function getAcceptStatus(seconds: number | null): MetricStatus {
  if (seconds === null) return 'Unavailable'
  if (seconds <= 300) return 'OK'
  if (seconds <= 600) return 'Watch'
  return 'Action required'
}

function getFcmStatus(rate: number | null): MetricStatus {
  if (rate === null) return 'Unavailable'
  if (rate >= 0.9) return 'OK'
  if (rate >= 0.8) return 'Watch'
  return 'Action required'
}

function getStatusClass(status: MetricStatus): string {
  if (status === 'OK') return 'text-[var(--color-success)]'
  if (status === 'Watch') return 'text-[var(--color-warning)]'
  if (status === 'Action required') return 'text-[var(--color-danger)]'
  return 'text-[var(--color-text-muted)]'
}

function getFcmCardClass(status: MetricStatus): string {
  if (status === 'OK') return 'border-t-green-400 text-green-400'
  if (status === 'Watch') return 'border-t-amber-400 text-amber-400'
  if (status === 'Action required') return 'border-t-red-400 text-red-400'
  return 'border-t-gray-400 text-gray-400'
}

function DecisionLine({ target, status }: { target: string; status: MetricStatus }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
      <span className="text-[var(--color-text-muted)]">{target}</span>
      <span className={`font-medium ${getStatusClass(status)}`}>{status}</span>
    </div>
  )
}

export function DispatchStatsCards({
  activeCount,
  stalledCount,
  avgAcceptSeconds,
  fcmSuccessRate,
  mode,
}: Props) {
  const isSurge = mode === 'surge'
  const activeStatus = getActiveStatus(activeCount)
  const stalledStatus: MetricStatus = stalledCount === 0 ? 'OK' : 'Action required'
  const acceptStatus = getAcceptStatus(avgAcceptSeconds)
  const fcmStatus = getFcmStatus(fcmSuccessRate)
  const fcmPercent = fcmSuccessRate === null ? null : Math.round(fcmSuccessRate * 100)

  return (
    <div className="flex gap-4">
      <div
        aria-label="Active Now"
        className="rounded-lg border-t-[3px] border-t-[var(--color-carto-blue)] bg-white/[0.03] p-4"
        role="region"
      >
        <div className="text-xs text-gray-400">Active Now</div>
        <div
          className="font-mono text-2xl font-bold text-white"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {activeCount}
        </div>
        <DecisionLine target="Target ≤ 20" status={activeStatus} />
      </div>

      <div
        aria-label="Stalled"
        className={`rounded-lg border-t-[3px] bg-white/[0.03] p-4 ${stalledCount > 0 ? 'border-t-red-400' : 'border-t-gray-400'}`}
        role="region"
      >
        <div className="text-xs text-gray-400">Stalled</div>
        <div
          className="font-mono text-2xl font-bold text-white"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {stalledCount}
        </div>
        <DecisionLine target="Target 0" status={stalledStatus} />
      </div>

      {!isSurge && (
        <div
          aria-label="Average accept time"
          className="rounded-lg border-t-[3px] border-t-gray-400 bg-white/[0.03] p-4"
          role="region"
        >
          <div className="text-xs text-gray-400">Avg Accept</div>
          <div
            className="font-mono text-2xl font-bold text-white"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {avgAcceptSeconds === null ? '—' : formatSeconds(avgAcceptSeconds)}
          </div>
          <DecisionLine target="Target ≤ 5m" status={acceptStatus} />
        </div>
      )}

      {!isSurge && (
        <div
          aria-label="FCM success rate"
          className={`rounded-lg border-t-[3px] bg-white/[0.03] p-4 ${getFcmCardClass(fcmStatus)}`}
          role="region"
        >
          <div className="text-xs">FCM Rate</div>
          <div
            className="font-mono text-2xl font-bold"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fcmPercent === null ? '—' : `${String(fcmPercent)}%`}
          </div>
          <DecisionLine target="Target ≥ 90%" status={fcmStatus} />
        </div>
      )}
    </div>
  )
}
