import { useState } from 'react'
import type { ReportOpsDoc } from '../hooks/useFirestoreListeners'

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

interface Props {
  reports: {
    id: string
    type: string
    severity: string
    municipality: string
    barangay: string
    createdAt: string
    status: string
    description: string
  }[]
  reportOps: ReportOpsDoc[]
  responders: [string, unknown][]
}

function isWithinTimeRange(createdAt: string, range: (typeof TIME_RANGES)[number]['id']): boolean {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return false
  const now = Date.now()
  const ms = date.getTime()
  if (range === '24h') return now - ms <= 24 * 60 * 60 * 1000
  if (range === '7d') return now - ms <= 7 * 24 * 60 * 60 * 1000
  // range === '30d'
  return now - ms <= 30 * 24 * 60 * 60 * 1000
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TrendAnalysisPanel({ reports, reportOps, responders }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('volume')
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]['id']>('7d')

  const chartLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'Chart'

  const filteredReports = reports.filter((r) => isWithinTimeRange(r.createdAt, timeRange))

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
        {filteredReports.length === 0 ? (
          <span role="status" className="text-sm text-white/50">
            No incidents in selected period
          </span>
        ) : (
          <span role="status" className="text-sm text-white/50">
            {chartLabel} — {timeRange} ({filteredReports.length} reports)
          </span>
        )}
      </div>
    </div>
  )
}
