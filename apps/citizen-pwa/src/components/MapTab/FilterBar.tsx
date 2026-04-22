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

const SEVERITIES: Filters['severity'][] = ['all', 'high', 'medium', 'low']
const WINDOWS: Filters['window'][] = ['24h', '7d', '30d']

function nextValue<T>(values: readonly T[], current: T): T {
  const index = values.indexOf(current)
  return values[(index + 1) % values.length] ?? current
}

export function FilterBar({ filters, onChange, disabled }: Props) {
  return (
    <div
      aria-label="Map filters"
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 40,
        display: 'flex',
        gap: 8,
        padding: 8,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.52)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (disabled) return
          onChange({ ...filters, severity: nextValue(SEVERITIES, filters.severity) })
        }}
        disabled={disabled}
        style={pillStyle(disabled, filters.severity !== 'all')}
      >
        Severity: {filters.severity}
      </button>
      <button
        type="button"
        onClick={() => {
          if (disabled) return
          onChange({ ...filters, window: nextValue(WINDOWS, filters.window) })
        }}
        disabled={disabled}
        style={pillStyle(disabled, filters.window !== '24h')}
      >
        Window: {filters.window}
      </button>
    </div>
  )
}

function pillStyle(disabled?: boolean, active?: boolean): CSSProperties {
  return {
    border: active ? '1px solid rgba(0, 30, 64, 0.18)' : '1px solid rgba(15, 23, 42, 0.12)',
    borderRadius: 999,
    background: active ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.92)',
    color: active ? 'var(--color-primary)' : 'var(--color-on-surface, #0f172a)',
    padding: '10px 14px',
    fontSize: '0.875rem',
    fontWeight: 600,
    lineHeight: 1,
    boxShadow: active ? '0 12px 28px rgba(0, 30, 64, 0.12)' : '0 8px 24px rgba(15, 23, 42, 0.08)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  }
}
