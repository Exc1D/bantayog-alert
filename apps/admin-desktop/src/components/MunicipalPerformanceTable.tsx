import { useState } from 'react'
import type { MunicipalPerformance } from '../types'

interface Props {
  data: MunicipalPerformance[]
  onSelectMunicipality: (municipality: string) => void
}

function responseTimeIndicator(avgResponseTime: string): string {
  const match = /(\d+)/.exec(avgResponseTime)
  const minutes = match?.[1] ? Number.parseInt(match[1], 10) : 0
  if (minutes < 12) return 'good'
  if (minutes <= 20) return 'warning'
  return 'bad'
}

export function MunicipalPerformanceTable({ data, onSelectMunicipality }: Props) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  const handleHeaderClick = (key: string) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const sorted =
    sortKey === 'activeIncidents'
      ? [...data].sort((a, b) => {
          const diff = a.activeIncidents - b.activeIncidents
          return sortAsc ? diff : -diff
        })
      : data

  return (
    <table>
      <thead>
        <tr>
          <th>Municipality</th>
          <th>
            <button
              type="button"
              onClick={() => {
                handleHeaderClick('activeIncidents')
              }}
            >
              Active Incidents
            </button>
          </th>
          <th>Responders</th>
          <th>Avg Response</th>
          <th>Admin</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr
            key={row.municipality}
            onClick={() => {
              onSelectMunicipality(row.municipality)
            }}
            style={{ cursor: 'pointer' }}
          >
            <td>{row.municipality}</td>
            <td>{row.activeIncidents}</td>
            <td>{row.activeResponders}</td>
            <td className={responseTimeIndicator(row.avgResponseTime)}>{row.avgResponseTime}</td>
            <td>{row.adminOnDuty ? 'On Duty' : 'No Shift'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
