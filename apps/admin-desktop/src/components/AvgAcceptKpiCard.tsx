import { getAvgAcceptKpiStatus } from '../utils/dispatch-kpi-status'
import { KpiStatusLabel } from './KpiStatusLabel'

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes)}m ${String(seconds)}s`
}

export function AvgAcceptKpiCard({ avgAcceptSeconds }: { avgAcceptSeconds: number | null }) {
  return (
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
      <KpiStatusLabel target="Target max 5m" status={getAvgAcceptKpiStatus(avgAcceptSeconds)} />
    </div>
  )
}
