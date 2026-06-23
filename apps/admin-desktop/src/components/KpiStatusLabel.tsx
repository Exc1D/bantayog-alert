import type { DispatchKpiStatus } from '../utils/dispatch-kpi-status'

function statusClass(status: DispatchKpiStatus): string {
  if (status === 'OK') return 'text-[var(--color-success)]'
  if (status === 'Watch') return 'text-[var(--color-warning)]'
  if (status === 'Action required') return 'text-[var(--color-danger)]'
  return 'text-[var(--color-text-muted)]'
}

export function KpiStatusLabel({
  target,
  status,
}: {
  target: string
  status: DispatchKpiStatus
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
      <span className="text-[var(--color-text-muted)]">{target}</span>
      <span className={`font-medium ${statusClass(status)}`}>{status}</span>
    </div>
  )
}
