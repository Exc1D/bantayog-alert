import { useState } from 'react'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import type { MunicipalPerformance } from '../hooks/useMunicipalPerformance'

type SortColumn = 'label' | 'avgResponseTimeMinutes' | 'resolvedToday'
type SortDirection = 'asc' | 'desc'

interface MunicipalPerformanceTableProps {
  data: MunicipalPerformance[]
}

const LABEL_MAP: Record<string, string> = Object.fromEntries(
  CAMARINES_NORTE_MUNICIPALITIES.map((m) => [m.id, m.label]),
)

const TH_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6b7280',
  borderBottom: '2px solid #e5e7eb',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
}

const TD_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '14px',
  borderBottom: '1px solid #f3f4f6',
}

function sortIndicator(col: SortColumn, active: SortColumn, dir: SortDirection): string {
  if (col !== active) return ' ↕'
  return dir === 'asc' ? ' ↑' : ' ↓'
}

export function MunicipalPerformanceTable({ data }: MunicipalPerformanceTableProps) {
  const [sortCol, setSortCol] = useState<SortColumn>('label')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  function handleSort(col: SortColumn) {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    let cmp = 0
    if (sortCol === 'label') {
      const aLabel = LABEL_MAP[a.municipalityId] ?? a.municipalityId
      const bLabel = LABEL_MAP[b.municipalityId] ?? b.municipalityId
      cmp = aLabel.localeCompare(bLabel)
    } else if (sortCol === 'avgResponseTimeMinutes') {
      const aVal = a.avgResponseTimeMinutes ?? Infinity
      const bVal = b.avgResponseTimeMinutes ?? Infinity
      cmp = aVal - bVal
    } else {
      cmp = a.resolvedToday - b.resolvedToday
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}
        aria-label="Municipal performance"
      >
        <thead>
          <tr>
            <th
              style={TH_STYLE}
              onClick={() => {
                handleSort('label')
              }}
              aria-sort={
                sortCol === 'label' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
              }
            >
              Municipality{sortIndicator('label', sortCol, sortDir)}
            </th>
            <th
              style={{ ...TH_STYLE, textAlign: 'right' }}
              onClick={() => {
                handleSort('avgResponseTimeMinutes')
              }}
              aria-sort={
                sortCol === 'avgResponseTimeMinutes'
                  ? sortDir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              Avg Response (min){sortIndicator('avgResponseTimeMinutes', sortCol, sortDir)}
            </th>
            <th
              style={{ ...TH_STYLE, textAlign: 'right' }}
              onClick={() => {
                handleSort('resolvedToday')
              }}
              aria-sort={
                sortCol === 'resolvedToday'
                  ? sortDir === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              Resolved Today{sortIndicator('resolvedToday', sortCol, sortDir)}
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={3} style={{ ...TD_STYLE, color: '#9ca3af', fontStyle: 'italic' }}>
                Loading…
              </td>
            </tr>
          )}
          {sorted.map((row) => {
            const label = LABEL_MAP[row.municipalityId] ?? row.municipalityId
            const isSlowResponse =
              row.avgResponseTimeMinutes !== null && row.avgResponseTimeMinutes > 15
            return (
              <tr
                key={row.municipalityId}
                style={{ background: isSlowResponse ? '#fff7ed' : undefined }}
              >
                <td style={TD_STYLE}>{label}</td>
                <td
                  style={{
                    ...TD_STYLE,
                    textAlign: 'right',
                    color: isSlowResponse ? '#c2410c' : undefined,
                    fontWeight: isSlowResponse ? 600 : undefined,
                  }}
                >
                  {row.avgResponseTimeMinutes !== null
                    ? row.avgResponseTimeMinutes.toFixed(1)
                    : '—'}
                </td>
                <td style={{ ...TD_STYLE, textAlign: 'right' }}>{row.resolvedToday}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
