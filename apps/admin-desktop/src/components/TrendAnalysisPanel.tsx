import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

const TABS = [
  { id: 'volume', label: 'Volume' },
  { id: 'response', label: 'Response' },
  { id: 'resource', label: 'Resources' },
  { id: 'comparison', label: 'Comparison' },
] as const

const TIME_RANGES = [
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
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
}

function isWithinTimeRange(createdAt: string, range: (typeof TIME_RANGES)[number]['id']): boolean {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return false
  const now = Date.now()
  const ms = date.getTime()
  if (range === '24h') return now - ms <= 24 * 60 * 60 * 1000
  if (range === '7d') return now - ms <= 7 * 24 * 60 * 60 * 1000
  return now - ms <= 30 * 24 * 60 * 60 * 1000
}

export function TrendAnalysisPanel({ reports }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('volume')
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]['id']>('7d')
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!timeDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTimeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [timeDropdownOpen])

  const chartLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'Chart'
  const timeLabel = TIME_RANGES.find((t) => t.id === timeRange)?.label ?? ''

  const filteredReports = reports.filter((r) => isWithinTimeRange(r.createdAt, timeRange))

  return (
    <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4">
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="relative ml-auto" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setTimeDropdownOpen((o) => !o)
            }}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-white/5"
            aria-haspopup="listbox"
            aria-expanded={timeDropdownOpen}
          >
            {timeLabel}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </button>
          {timeDropdownOpen && (
            <div
              className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-md border border-white/10 bg-[var(--color-surface-elevated)] shadow-lg"
              role="listbox"
            >
              {TIME_RANGES.map((range) => (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => {
                    setTimeRange(range.id)
                    setTimeDropdownOpen(false)
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] hover:bg-white/5"
                  role="option"
                  aria-selected={timeRange === range.id}
                  style={{
                    color: timeRange === range.id ? 'white' : undefined,
                    backgroundColor: timeRange === range.id ? 'var(--color-sienna)' : undefined,
                  }}
                >
                  {range.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex h-48 items-center justify-center rounded border border-white/5 bg-[var(--color-surface)]">
        {filteredReports.length === 0 ? (
          <span role="status" className="text-sm text-white/50">
            No incidents in selected period
          </span>
        ) : (
          <span role="status" className="text-sm text-white/50">
            {chartLabel} · {timeLabel} ({String(filteredReports.length)} reports)
          </span>
        )}
      </div>
    </div>
  )
}
