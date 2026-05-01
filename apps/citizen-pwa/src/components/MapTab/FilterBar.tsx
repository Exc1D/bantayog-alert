import { Search } from 'lucide-react'

type SeverityFilter = 'all' | 'high' | 'medium' | 'low'
type WindowFilter = '24h' | '7d' | '30d'

export interface Filters {
  severity: SeverityFilter
  window: WindowFilter
}

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  disabled?: boolean
}

const SEVERITIES: { value: SeverityFilter; label: string; dot?: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High', dot: '#dc2626' },
  { value: 'medium', label: 'Medium', dot: '#a73400' },
  { value: 'low', label: 'Low', dot: '#414849' },
]

const WINDOWS: { value: WindowFilter; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]

export function FilterBar({ filters, onChange, disabled }: Props) {
  return (
    <div
      aria-label="Map filters"
      className="absolute top-3 left-3 right-3 z-40 p-2.5 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg flex flex-col gap-1.5"
    >
      {/* Search pill header */}
      <div className="flex items-center gap-2 px-2 py-1">
        <Search size={14} className="text-[#768081] flex-shrink-0" aria-hidden="true" />
        <span className="text-sm text-[#768081] font-medium">Filter incidents</span>
      </div>

      <div role="group" aria-label="Severity" className="flex gap-1">
        {SEVERITIES.map(({ value, label, dot }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filters.severity === value}
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              onChange({ ...filters, severity: value })
            }}
            className={buildChipClass(filters.severity === value, disabled)}
          >
            {dot ? (
              <span
                aria-hidden="true"
                className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                style={{ background: dot }}
              />
            ) : null}
            {label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Time window" className="flex gap-1">
        {WINDOWS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filters.window === value}
            disabled={disabled}
            onClick={() => {
              if (disabled) return
              onChange({ ...filters, window: value })
            }}
            className={buildChipClass(filters.window === value, disabled)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function buildChipClass(active?: boolean, disabled?: boolean): string {
  const base = 'flex-1 rounded-full px-2 py-[5px] text-xs text-center transition-colors'
  const visual = active
    ? 'bg-surface-900 text-white font-bold border-[1.5px] border-surface-900/20'
    : 'bg-white/90 text-[#0f172a] font-medium border-[1.5px] border-[#0f172a]/8'
  const state = disabled ? ' opacity-55 cursor-not-allowed' : ' cursor-pointer'
  return base + ' ' + visual + state
}
