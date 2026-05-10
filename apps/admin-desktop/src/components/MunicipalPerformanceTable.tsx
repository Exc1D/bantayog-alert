import { useState } from 'react'
import type { MunicipalPerformance } from '../types'

interface Props {
  data: MunicipalPerformance[]
  onSelectMunicipality: (municipality: string) => void
}

function responseTimeColor(avgResponseTime: string): string {
  const match = /(\d+)/.exec(avgResponseTime)
  const minutes = match?.[1] ? Number.parseInt(match[1], 10) : 0
  if (minutes < 12) return '#22c55e'
  if (minutes <= 20) return '#c77600'
  return '#a73400'
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
    sortKey === null
      ? data
      : [...data].sort((a, b) => {
          let diff = 0
          if (sortKey === 'activeIncidents') {
            diff = a.activeIncidents - b.activeIncidents
          } else if (sortKey === 'municipality') {
            diff = a.municipality.localeCompare(b.municipality)
          } else if (sortKey === 'avgResponseTime') {
            const matchA = /(\d+)/.exec(a.avgResponseTime)
            const matchB = /(\d+)/.exec(b.avgResponseTime)
            const minA = matchA?.[1] ? Number.parseInt(matchA[1], 10) : 0
            const minB = matchB?.[1] ? Number.parseInt(matchB[1], 10) : 0
            diff = minA - minB
          }
          return sortAsc ? diff : -diff
        })

  return (
    <table>
      <thead>
        <tr>
          <th>
            <button
              type="button"
              onClick={() => {
                handleHeaderClick('municipality')
              }}
            >
              Municipality
            </button>
          </th>
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
          <th>
            <button
              type="button"
              onClick={() => {
                handleHeaderClick('avgResponseTime')
              }}
            >
              Avg Response
            </button>
          </th>
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
            <td style={{ color: responseTimeColor(row.avgResponseTime) }}>{row.avgResponseTime}</td>
            <td>{row.adminOnDuty ? 'On Duty' : 'No Shift'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
