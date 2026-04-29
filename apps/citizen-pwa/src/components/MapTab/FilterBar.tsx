import type { CSSProperties } from 'react'

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
  { value: 'low', label: 'Low', dot: '#001e40' },
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
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        zIndex: 40,
        padding: '8px 10px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div role="group" aria-label="Severity" style={{ display: 'flex', gap: 4 }}>
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
            style={chipStyle(filters.severity === value, disabled)}
          >
            {dot ? (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: dot,
                  marginRight: 4,
                  verticalAlign: 'middle',
                }}
              />
            ) : null}
            {label}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Time window" style={{ display: 'flex', gap: 4 }}>
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
            style={chipStyle(filters.window === value, disabled)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function chipStyle(active?: boolean, disabled?: boolean): CSSProperties {
  return {
    flex: 1,
    border: active ? '1.5px solid rgba(0,30,64,0.22)' : '1.5px solid rgba(15,23,42,0.08)',
    borderRadius: 999,
    background: active ? '#001e40' : 'rgba(255,255,255,0.9)',
    color: active ? '#ffffff' : '#0f172a',
    padding: '5px 8px',
    fontSize: '0.75rem',
    fontWeight: active ? 700 : 500,
    lineHeight: 1.2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    textAlign: 'center',
  }
}
