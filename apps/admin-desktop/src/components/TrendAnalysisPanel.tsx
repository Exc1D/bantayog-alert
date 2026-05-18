import { useState, useRef, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronDown } from 'lucide-react'

const TIME_RANGES = [
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
] as const

interface Props {
  reports: {
    id: string
    type?: string
    reportType?: string
    severity: string
    municipality?: string
    municipalityLabel?: string
    barangay?: string
    barangayId?: string
    createdAt?: string | number | { toDate(): Date }
    submittedAt?: string | number | { toDate(): Date }
    status: string
    description: string
  }[]
}

function toEpochMs(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d.getTime()
  }
  if (
    raw != null &&
    typeof raw === 'object' &&
    typeof (raw as { toDate?: unknown }).toDate === 'function'
  ) {
    const dt = (raw as { toDate: () => Date }).toDate()
    return dt instanceof Date && !Number.isNaN(dt.getTime()) ? dt.getTime() : null
  }
  return null
}

function isWithinTimeRange(
  raw: string | number | { toDate(): Date } | undefined,
  range: (typeof TIME_RANGES)[number]['id'],
): boolean {
  const ms = toEpochMs(raw)
  if (ms === null) return false
  const now = Date.now()
  if (range === '24h') return now - ms <= 24 * 60 * 60 * 1000
  if (range === '7d') return now - ms <= 7 * 24 * 60 * 60 * 1000
  return now - ms <= 30 * 24 * 60 * 60 * 1000
}

function getRangeHours(range: (typeof TIME_RANGES)[number]['id']): number {
  if (range === '24h') return 24
  if (range === '7d') return 7 * 24
  return 30 * 24
}

function formatBucketLabel(bucketMs: number, range: (typeof TIME_RANGES)[number]['id']): string {
  const d = new Date(bucketMs)
  if (range === '24h') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TrendAnalysisPanel({ reports }: Props) {
  const [timeRange, setTimeRange] = useState<(typeof TIME_RANGES)[number]['id']>('7d')
  const [timeDropdownOpen, setTimeDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!timeDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTimeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
    }
  }, [timeDropdownOpen])

  const timeLabel = TIME_RANGES.find((t) => t.id === timeRange)?.label ?? ''

  const filteredReports = useMemo(
    () => reports.filter((r) => isWithinTimeRange(r.submittedAt ?? r.createdAt, timeRange)),
    [reports, timeRange],
  )

  const volumeData = useMemo(() => {
    if (filteredReports.length === 0) return []
    const rangeHours = getRangeHours(timeRange)
    const bucketMs = rangeHours <= 24 ? 3600000 : 86400000

    const buckets = new Map<number, number>()
    filteredReports.forEach((r) => {
      const ms = toEpochMs(r.submittedAt ?? r.createdAt)
      if (ms === null) return
      const slot = Math.floor(ms / bucketMs) * bucketMs
      buckets.set(slot, (buckets.get(slot) ?? 0) + 1)
    })

    if (buckets.size === 0) return []

    const slots = Array.from(buckets.keys()).sort((a, b) => a - b)
    const firstSlot = slots[0]
    const lastSlot = slots[slots.length - 1]
    if (firstSlot === undefined || lastSlot === undefined) return []
    const result: { label: string; count: number }[] = []
    for (let ts = firstSlot; ts <= lastSlot; ts += bucketMs) {
      result.push({
        label: formatBucketLabel(ts, timeRange),
        count: buckets.get(ts) ?? 0,
      })
    }
    return result
  }, [filteredReports, timeRange])

  return (
    <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Incident Volume</h3>
        <div className="relative" ref={dropdownRef}>
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
        ) : volumeData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-surface-elevated)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface-elevated)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--color-text-primary)',
                }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar
                dataKey="count"
                fill="var(--color-sienna)"
                radius={[2, 2, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <span role="status" className="text-sm text-white/50">
            Incident Volume · {timeLabel} ({String(filteredReports.length)} reports)
          </span>
        )}
      </div>
    </div>
  )
}
