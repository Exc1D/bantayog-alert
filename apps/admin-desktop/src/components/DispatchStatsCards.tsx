import { useRef, useEffect, useState } from 'react'
import type { DashboardMode } from '../utils/dashboard-mode'

interface Props {
  activeCount: number
  stalledCount: number
  avgAcceptSeconds: number | null
  fcmSuccessRate: number
  mode: DashboardMode
}

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m)}m ${String(s)}s`
}

export function DispatchStatsCards({
  activeCount,
  stalledCount,
  avgAcceptSeconds,
  fcmSuccessRate,
  mode,
}: Props) {
  const isSurge = mode === 'surge'
  const fcmPercent = Math.round(fcmSuccessRate * 100)
  const isFcmHigh = fcmSuccessRate >= 0.9
  const prevRef = useRef<number | null>(null)
  const [trend, setTrend] = useState<{ arrow: string; color: string } | null>(null)

  useEffect(() => {
    if (avgAcceptSeconds === null || prevRef.current === null) {
      prevRef.current = avgAcceptSeconds
      setTrend(null)
      return
    }
    const diff = avgAcceptSeconds - prevRef.current
    const threshold = prevRef.current * 0.1
    if (Math.abs(diff) > threshold) {
      setTrend({
        arrow: diff > 0 ? '↑' : '↓',
        color: diff > 0 ? 'text-[var(--color-warning)]' : 'text-[var(--color-success)]',
      })
    } else {
      setTrend(null)
    }
    prevRef.current = avgAcceptSeconds
  }, [avgAcceptSeconds])

  return (
    <div className="flex gap-4">
      <div
        aria-label="Active Now"
        className="rounded-lg border-t-[3px] border-t-blue-400 bg-white/[0.03] p-4"
        role="region"
      >
        <div className="text-xs text-gray-400">Active Now</div>
        <div className="text-2xl font-bold text-white">{activeCount}</div>
      </div>

      <div
        aria-label="Stalled"
        className={`rounded-lg border-t-[3px] p-4 bg-white/[0.03] ${stalledCount > 0 ? 'border-t-red-400' : 'border-t-gray-400'}`}
        role="region"
      >
        <div className="text-xs text-gray-400">Stalled</div>
        <div className="text-2xl font-bold text-white">{stalledCount}</div>
      </div>

      {!isSurge && (
        <div
          aria-label="Average accept time"
          className="rounded-lg border-t-[3px] border-t-gray-400 bg-white/[0.03] p-4"
          role="region"
        >
          <div className="flex items-center gap-2 text-xs text-gray-400">
            Avg Accept
            {trend && <span className={`${trend.color} text-xs`}>{trend.arrow}</span>}
          </div>
          <div className="text-2xl font-bold text-white">
            {avgAcceptSeconds !== null ? formatSeconds(avgAcceptSeconds) : '—'}
          </div>
        </div>
      )}

      {!isSurge && (
        <div
          aria-label="FCM success rate"
          className={`rounded-lg border-t-[3px] p-4 bg-white/[0.03] ${isFcmHigh ? 'border-t-green-400 text-green-400' : 'border-t-amber-400 text-amber-400'}`}
          role="region"
        >
          <div className="text-xs">FCM Rate</div>
          <div className="text-2xl font-bold">{fcmPercent}%</div>
        </div>
      )}
    </div>
  )
}
