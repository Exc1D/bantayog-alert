import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'
import type { MunicipalPerformance, Report } from '../types'

const ACTIVE_DISPATCH_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
  'escalated',
])

function normalizeMunicipality(value: string): string {
  return value.trim().toLowerCase()
}

export function getActiveDispatchCount(rows: DispatchLifecycleRow[]): number {
  return rows.filter((row) => ACTIVE_DISPATCH_STATUSES.has(row.status)).length
}

export function buildMunicipalData(
  reports: Report[],
  responders: ResponderFleetMember[],
): MunicipalPerformance[] {
  const reportsByMunicipality = new Map<string, Report[]>()
  const responderCountByMunicipality = new Map<string, number>()

  for (const report of reports) {
    const municipality = report.municipality.trim() || 'Unknown'
    const municipalityReports = reportsByMunicipality.get(municipality) ?? []
    municipalityReports.push(report)
    reportsByMunicipality.set(municipality, municipalityReports)
  }

  for (const responder of responders) {
    if (!responder.municipalityId?.trim()) continue
    const municipalityKey = normalizeMunicipality(responder.municipalityId)
    responderCountByMunicipality.set(
      municipalityKey,
      (responderCountByMunicipality.get(municipalityKey) ?? 0) + 1,
    )
  }

  return Array.from(reportsByMunicipality.entries()).map(([municipality, municipalityReports]) => ({
    activeIncidents: municipalityReports.filter((report) =>
      ACTIVE_REPORT_STATUSES.includes(report.status),
    ).length,
    activeResponders: responderCountByMunicipality.get(normalizeMunicipality(municipality)) ?? 0,
    municipality,
  }))
}

export function getAffectedMunicipalities(municipalData: MunicipalPerformance[]): string[] {
  return municipalData
    .filter((municipality) => municipality.activeIncidents > 0)
    .map((municipality) => municipality.municipality)
}

export function getUncoveredMunicipalityCount(municipalData: MunicipalPerformance[]): number {
  return municipalData.filter(
    (municipality) =>
      municipality.activeIncidents > 0 && (municipality.activeResponders ?? 0) === 0,
  ).length
}
