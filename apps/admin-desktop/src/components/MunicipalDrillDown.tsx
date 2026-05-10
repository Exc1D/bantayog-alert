import { X } from 'lucide-react'
import type { MunicipalPerformance } from '../types'

interface Props {
  data: MunicipalPerformance
  onClose: () => void
  onViewAll: (municipality: string) => void
  onContactAdmin: (municipality: string) => void
}

export function MunicipalDrillDown({ data, onClose, onViewAll, onContactAdmin }: Props) {
  return (
    <div
      className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4 shadow-xl"
      style={{ pointerEvents: 'none' }}
    >
      <div className="flex items-start justify-between" style={{ pointerEvents: 'auto' }}>
        <h3 className="font-semibold text-[var(--color-text-primary)]">
          {data.municipality} Municipality
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 hover:bg-white/10"
          aria-label="Close"
          style={{ pointerEvents: 'auto' }}
        >
          <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {data.activeIncidents}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">Active Incidents</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {data.activeResponders}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">Available Responders</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {data.avgResponseTime}
          </span>
          <span className="text-xs text-[var(--color-text-secondary)]">Avg Response</span>
        </div>
        {data.adminOnDuty && data.adminName && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {data.adminName} (On Duty)
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-2" style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={() => {
            onViewAll(data.municipality)
          }}
          className="rounded-md bg-[var(--color-sienna)] px-3 py-1.5 text-xs text-white hover:opacity-90"
        >
          View All
        </button>
        <button
          type="button"
          onClick={() => {
            onContactAdmin(data.municipality)
          }}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-white/10"
        >
          Contact Admin
        </button>
      </div>
    </div>
  )
}
