import { getFcmKpiStatus } from '../utils/dispatch-kpi-status'
import { KpiStatusLabel } from './KpiStatusLabel'

export function FcmKpiCard({ value }: { value: number | null }) {
  const status = getFcmKpiStatus(value)
  const percent = value === null ? null : Math.round(value * 100)

  return (
    <div
      aria-label="FCM success rate"
      className="rounded-lg border-t-[3px] border-t-gray-400 bg-white/[0.03] p-4"
      role="region"
    >
      <div className="text-xs text-gray-400">FCM Rate</div>
      <div className="font-mono text-2xl font-bold text-white">
        {percent === null ? '—' : `${String(percent)}%`}
      </div>
      <KpiStatusLabel target="Target min 90%" status={status} />
    </div>
  )
}
