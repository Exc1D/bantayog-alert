import type { ReactNode } from 'react'
import type { DashboardMode } from '../utils/dashboard-mode'

interface Props {
  activeCount: number
  stalledCount: number
  avgAcceptSeconds: number | null
  fcmSuccessRate: number | null
  mode: DashboardMode
}

type MetricStatus = 'OK' | 'Watch' | 'Action required' | 'Unavailable'

interface MetricCardProps {
  ariaLabel: string
  label: string
  status: MetricStatus
  target: string
  value: ReactNode
  accentClass?: string
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes)}m ${String(seconds)}s`
}

function getStatusClass(status: MetricStatus): string {
  if (status === 'OK') return 'text-[var(--color-success)]'
  if (status === 'Watch') return 'text-[var(--color-warning)]'
  if (status === 'Action required') return 'text-[var(--color-danger)]'
  return 'text-[var(--color-text-muted)]'
}

function getActiveStatus(mode: DashboardMode): MetricStatus {
  if (mode === 'surge') return 'Action required'
  if (mode === 'calm') return 'OK'
  return 'Watch'
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

function MetricCard({
  ariaLabel,
  label,
  status,
  target,
  value,
  accentClass = 'border-t-gray-400',
}: MetricCardProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={`rounded-lg border-t-[3px] bg-white/[0.03] p-4 ${accentClass}`}
      role="region"
    >
      <div className="text-xs text-gray-400">{label}</div>
      <div
        className="font-mono text-2xl font-bold text-white"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-[var(--color-text-muted)]">{target}</span>
        <span className={`font-medium ${getStatusClass(status)}`}>{status}</span>
      </div>
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
  const avgAcceptStatus = getAcceptStatus(avgAcceptSeconds)
  const fcmStatus = getFcmStatus(fcmSuccessRate)
  const fcmPercent = fcmSuccessRate === null ? null : Math.round(fcmSuccessRate * 100)

  return (
    <div className="flex gap-4">
      <MetricCard
        ariaLabel="Active Now"
        label="Active Now"
        value={activeCount}
        target="Target max 20"
        status={getActiveStatus(mode)}
        accentClass="border-t-[var(--color-carto-blue)]"
      />
      <MetricCard
        ariaLabel="Stalled"
        label="Stalled"
        value={stalledCount}
        target="Target 0"
        status={stalledCount === 0 ? 'OK' : 'Action required'}
        accentClass={stalledCount === 0 ? 'border-t-gray-400' : 'border-t-red-400'}
      />
      {mode !== 'surge' && (
        <MetricCard
          ariaLabel="Average accept time"
          label="Avg Accept"
          value={avgAcceptSeconds === null ? '—' : formatSeconds(avgAcceptSeconds)}
          target="Target max 5m"
          status={avgAcceptStatus}
        />
      )}
      {mode !== 'surge' && (
        <MetricCard
          ariaLabel="FCM success rate"
          label="FCM Rate"
          value={fcmPercent === null ? '—' : `${String(fcmPercent)}%`}
          target="Target min 90%"
          status={fcmStatus}
        />
      )}
    </div>
  )
}
