import { useState } from 'react'

const TABS = [
  { id: 'volume', label: 'Incident Volume' },
  { id: 'response', label: 'Response Time' },
  { id: 'resource', label: 'Resource Util' },
  { id: 'comparison', label: 'Muni Comparison' },
] as const

const TIME_RANGES = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
] as const

export function TrendAnalysisPanel() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('volume')
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]['id']>('7d')

  const chartLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'Chart'

  return (
    <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id)
              }}
              aria-pressed={activeTab === tab.id}
              className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: activeTab === tab.id ? 'var(--color-sienna)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--color-text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              onClick={() => {
                setTimeRange(range.id)
              }}
              aria-pressed={timeRange === range.id}
              className="rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: timeRange === range.id ? 'var(--color-navy)' : 'transparent',
                color:
                  timeRange === range.id ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
              }}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex h-48 items-center justify-center rounded border border-white/5 bg-[var(--color-surface)]">
        <span
          role="img"
          aria-label={`${chartLabel} chart`}
          className="text-sm text-[var(--color-text-muted)]"
        >
          {chartLabel} — {timeRange}
        </span>
      </div>
    </div>
  )
}
