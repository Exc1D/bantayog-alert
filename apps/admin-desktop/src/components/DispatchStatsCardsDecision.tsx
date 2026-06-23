import type { DashboardMode } from '../utils/dashboard-mode'
import { ActiveDispatchKpiCard } from './ActiveDispatchKpiCard'
import { AvgAcceptKpiCard } from './AvgAcceptKpiCard'
import { FcmKpiCard } from './FcmKpiCard'
import { StalledDispatchKpiCard } from './StalledDispatchKpiCard'

interface Props {
  activeCount: number
  stalledCount: number
  avgAcceptSeconds: number | null
  fcmSuccessRate: number | null
  mode: DashboardMode
}

export function DispatchStatsCards({
  activeCount,
  stalledCount,
  avgAcceptSeconds,
  fcmSuccessRate,
  mode,
}: Props) {
  const isSurge = mode === 'surge'

  return (
    <div className="flex gap-4">
      <ActiveDispatchKpiCard activeCount={activeCount} mode={mode} />
      <StalledDispatchKpiCard stalledCount={stalledCount} />
      {!isSurge && <AvgAcceptKpiCard avgAcceptSeconds={avgAcceptSeconds} />}
      {!isSurge && <FcmKpiCard value={fcmSuccessRate} />}
    </div>
  )
}
