import type { DashboardMode } from '../utils/dashboard-mode'
import { DISPATCH_KPI_TARGETS, getActiveKpiStatus } from '../utils/dispatch-kpi-status'
import { KpiStatusLabel } from './KpiStatusLabel'

export function ActiveDispatchKpiCard({
  activeCount,
  mode,
}: {
  activeCount: number
  mode: DashboardMode
}) {
  return (
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
      <KpiStatusLabel
        target={`Target max ${String(DISPATCH_KPI_TARGETS.activeMax)}`}
        status={getActiveKpiStatus(mode)}
      />
    </div>
  )
}
