import { useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { MunicipalPerformance } from '../types'

type SortKey = 'municipality' | 'activeIncidents' | 'avgResponseTime'

interface Props {
  data: MunicipalPerformance[]
  onSelectMunicipality: (municipality: string) => void
}

function parseMinutes(value: string): number {
  const match = /(\d+)/.exec(value)
  return match?.[1] ? Number.parseInt(match[1], 10) : 0
}

function responseTimeToken(avgResponseTime: string): string {
  const minutes = parseMinutes(avgResponseTime)
  if (minutes < 12) return 'var(--color-norm)'
  if (minutes <= 20) return 'var(--color-warn)'
  return 'var(--color-crit)'
}

export function MunicipalPerformanceTable({ data, onSelectMunicipality }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const handleHeaderClick = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted =
    sortKey === null
      ? data
      : [...data].sort((a, b) => {
          let diff = 0
          if (sortKey === 'activeIncidents') {
            diff = a.activeIncidents - b.activeIncidents
          } else if (sortKey === 'municipality') {
            diff = a.municipality.localeCompare(b.municipality)
          } else {
            const aMin =
              a.avgResponseTime === undefined ? Infinity : parseMinutes(a.avgResponseTime)
            const bMin =
              b.avgResponseTime === undefined ? Infinity : parseMinutes(b.avgResponseTime)
            diff = aMin - bMin
          }
          return sortAsc ? diff : -diff
        })

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />
    }
    return sortAsc ? (
      <ArrowUp className="h-3 w-3" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3 w-3" aria-hidden="true" />
    )
  }

  const sortLabel = (key: SortKey) =>
    sortKey === key ? (sortAsc ? 'ascending' : 'descending') : 'none'

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-[var(--color-surface-elevated)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase text-[var(--color-text-muted)]">
          <tr>
            <th scope="col" className="px-4 py-2" aria-sort={sortLabel('municipality')}>
              <button
                type="button"
                onClick={() => {
                  handleHeaderClick('municipality')
                }}
                className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-[var(--color-text-secondary)]"
              >
                Municipality
                {renderSortIcon('municipality')}
              </button>
            </th>
            <th scope="col" className="px-4 py-2" aria-sort={sortLabel('activeIncidents')}>
              <button
                type="button"
                onClick={() => {
                  handleHeaderClick('activeIncidents')
                }}
                className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-[var(--color-text-secondary)]"
              >
                Active Incidents
                {renderSortIcon('activeIncidents')}
              </button>
            </th>
            <th scope="col" className="px-4 py-2">
              Responders
            </th>
            <th scope="col" className="px-4 py-2" aria-sort={sortLabel('avgResponseTime')}>
              <button
                type="button"
                onClick={() => {
                  handleHeaderClick('avgResponseTime')
                }}
                className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-[var(--color-text-secondary)]"
              >
                Avg Response
                {renderSortIcon('avgResponseTime')}
              </button>
            </th>
            <th scope="col" className="px-4 py-2">
              Admin
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                <span role="status">No municipal data</span>
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={row.municipality}
                onClick={() => {
                  onSelectMunicipality(row.municipality)
                }}
                className="cursor-pointer border-b border-white/5 hover:bg-white/5"
              >
                <td className="px-4 py-3 text-[var(--color-text-primary)]">{row.municipality}</td>
                <td
                  className="px-4 py-3 font-mono text-[var(--color-text-primary)]"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {row.activeIncidents}
                </td>
                <td
                  className="px-4 py-3 font-mono text-[var(--color-text-secondary)]"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                  data-testid={`muniperf-responders-${row.municipality}`}
                >
                  {row.activeResponders ?? '—'}
                </td>
                <td
                  className="px-4 py-3 font-mono"
                  style={{
                    color:
                      row.avgResponseTime === undefined
                        ? 'var(--color-text-secondary)'
                        : responseTimeToken(row.avgResponseTime),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  data-testid={`muniperf-response-${row.municipality}`}
                >
                  {row.avgResponseTime ?? '—'}
                </td>
                <td
                  className="px-4 py-3 text-[var(--color-text-secondary)]"
                  data-testid={`muniperf-admin-${row.municipality}`}
                >
                  {row.adminOnDuty === undefined ? (
                    '—'
                  ) : row.adminOnDuty ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-norm)' }}
                        aria-hidden="true"
                      />
                      On Duty
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[var(--color-text-muted)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/20" aria-hidden="true" />
                      No Shift
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
