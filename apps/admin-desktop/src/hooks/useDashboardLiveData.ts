import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { db } from '@/app/firebase'
import { useMunicipalPerformance } from './useMunicipalPerformance'
import { useProvinceMetrics } from './useProvinceMetrics'

interface OpsRow {
  reportId: string
  municipalityId: string
  createdAt: Timestamp
}

export interface LiveMunicipalRow {
  municipalityId: string
  municipality: string
  activeIncidents: number
  avgResponseTime: string
  unresolvedOver24h: number
  resolvedToday: number
}

export interface LiveAnomaly {
  id: string
  message: string
  detectedAt: string
}

export interface DashboardLiveData {
  activeIncidents: number
  respondersAvailable: number
  avgResponseTime: string
  resolvedToday: number
  unresolvedOver24h: number
  municipalitiesAffected: number
  systemHealthy: boolean | null
  municipalData: LiveMunicipalRow[]
  anomalies: LiveAnomaly[]
  lastUpdated: number | null
}

const MUNI_NAME: Record<string, string> = Object.fromEntries(
  CAMARINES_NORTE_MUNICIPALITIES.map((m) => [m.id, m.label]),
)

function formatMinutes(min: number): string {
  const m = Math.floor(min)
  const s = Math.round((min - m) * 60)
  return `${String(m)}:${String(s).padStart(2, '0')}`
}

// 24h threshold computed once on mount — acceptable for operational sessions
// (re-mount the page if open past midnight for accurate counts)
function yesterdayTimestamp(): number {
  return Date.now() - 24 * 60 * 60 * 1000
}

export function useDashboardLiveData(municipalityId?: string): DashboardLiveData {
  const provinceMetrics = useProvinceMetrics()
  const municipalPerf = useMunicipalPerformance()

  const [opsReports, setOpsReports] = useState<OpsRow[]>([])
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const cutoff = useMemo(() => yesterdayTimestamp(), [])

  useEffect(() => {
    const base = collection(db, 'report_ops')
    const q = municipalityId
      ? query(
          base,
          where('municipalityId', '==', municipalityId),
          where('status', 'in', ACTIVE_REPORT_STATUSES),
        )
      : query(base, where('status', 'in', ACTIVE_REPORT_STATUSES))

    return onSnapshot(q, (snap) => {
      setOpsReports(
        snap.docs.map((d) => ({
          reportId: d.id,
          municipalityId: String(d.data().municipalityId ?? ''),
          createdAt: d.data().createdAt as Timestamp,
        })),
      )
      setLastUpdated(Date.now())
    })
  }, [municipalityId])

  const { activeByMuni, staleByMuni } = useMemo(() => {
    const active: Record<string, number> = {}
    const stale: Record<string, number> = {}
    for (const r of opsReports) {
      active[r.municipalityId] = (active[r.municipalityId] ?? 0) + 1
      if (r.createdAt.toMillis() < cutoff) {
        stale[r.municipalityId] = (stale[r.municipalityId] ?? 0) + 1
      }
    }
    return { activeByMuni: active, staleByMuni: stale }
  }, [opsReports, cutoff])

  const activeIncidents = opsReports.length
  const unresolvedOver24h = opsReports.filter((r) => r.createdAt.toMillis() < cutoff).length
  const municipalitiesAffected = new Set(opsReports.map((r) => r.municipalityId)).size

  const municipalData = useMemo<LiveMunicipalRow[]>(
    () =>
      municipalPerf.map((m) => ({
        municipalityId: m.municipalityId,
        municipality: MUNI_NAME[m.municipalityId] ?? m.municipalityId,
        activeIncidents: activeByMuni[m.municipalityId] ?? 0,
        avgResponseTime:
          m.avgResponseTimeMinutes !== null ? formatMinutes(m.avgResponseTimeMinutes) : '—',
        unresolvedOver24h: staleByMuni[m.municipalityId] ?? 0,
        resolvedToday: m.resolvedToday,
      })),
    [municipalPerf, activeByMuni, staleByMuni],
  )

  // Derive anomalies from live response time data: any active municipality
  // exceeding 20-min avg response time crosses the spec threshold (§4.1).
  const anomalies = useMemo<LiveAnomaly[]>(
    () =>
      municipalData
        .filter((m) => {
          if (m.activeIncidents === 0 || m.avgResponseTime === '—') return false
          const minutes = parseInt(m.avgResponseTime.split(':')[0] ?? '0', 10)
          return minutes > 20
        })
        .map((m) => ({
          id: `slow-response-${m.municipalityId}`,
          message: `${m.municipality}: avg response time ${m.avgResponseTime} (target <20:00)`,
          detectedAt: new Date().toISOString(),
        })),
    [municipalData],
  )

  return {
    activeIncidents,
    respondersAvailable: provinceMetrics.respondersAvailable,
    avgResponseTime:
      provinceMetrics.avgResponseTimeMinutes !== null
        ? formatMinutes(provinceMetrics.avgResponseTimeMinutes)
        : '—',
    resolvedToday: provinceMetrics.resolvedToday,
    unresolvedOver24h,
    municipalitiesAffected,
    systemHealthy: provinceMetrics.health?.healthy ?? null,
    municipalData,
    anomalies,
    lastUpdated,
  }
}
