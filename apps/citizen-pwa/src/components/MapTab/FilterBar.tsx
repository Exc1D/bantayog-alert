import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import type { Filters } from './types.js'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  disabled?: boolean
}

const MUNICIPALITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  ...[...CAMARINES_NORTE_MUNICIPALITIES]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((m) => ({ value: m.label, label: m.label })),
]

export function FilterBar({ filters, onChange, disabled }: Props) {
  return (
    <div
      aria-label="Map filters"
      className="absolute top-3 left-3 right-3 z-40 px-3 py-2.5 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg"
    >
      <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">
        Municipality
      </p>
      <div
        role="group"
        aria-label="Filter by municipality"
        className="overflow-x-auto no-scrollbar -mx-1 px-1"
      >
        <div className="flex gap-1 min-w-max pb-0.5">
          {MUNICIPALITY_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filters.municipality === value}
              disabled={disabled}
              onClick={() => {
                if (disabled) return
                onChange({ municipality: value })
              }}
              className={buildChipClass(filters.municipality === value, disabled)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function buildChipClass(active?: boolean, disabled?: boolean): string {
  const base = 'rounded-full px-3 py-[5px] text-xs text-center transition-colors whitespace-nowrap'
  const visual = active
    ? 'bg-surface-900 text-white font-bold border-[1.5px] border-surface-900/20'
    : 'bg-white/90 text-[#0f172a] font-medium border-[1.5px] border-[#0f172a]/8'
  const state = disabled ? ' opacity-55 cursor-not-allowed' : ' cursor-pointer'
  return base + ' ' + visual + state
}
