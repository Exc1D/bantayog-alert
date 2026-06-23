import { getStalledKpiStatus } from '../utils/dispatch-kpi-status'
import { KpiStatusLabel } from './KpiStatusLabel'

export function StalledDispatchKpiCard({ stalledCount }: { stalledCount: number }) {
  return (
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
      <KpiStatusLabel target="Target 0" status={getStalledKpiStatus(stalledCount)} />
    </div>
  )
}
