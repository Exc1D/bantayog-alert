import type { Severity } from '@bantayog/shared-types'

const HIGH_IF_INJURED = new Set<string>([
  'medical',
  'accident',
  'fire',
  'landslide',
  'flood',
  'structural',
])

const MEDIUM_BY_TYPE = new Set<string>([
  'flood',
  'fire',
  'landslide',
  'storm_surge',
  'structural',
  'accident',
])

export interface DeriveReportSeverityInput {
  reportType: string
  peopleInjured: boolean
  peopleTrapped: boolean
}

export function deriveReportSeverity(input: DeriveReportSeverityInput): Severity {
  const reportType = input.reportType === 'public_disturbance' ? 'security' : input.reportType

  if (input.peopleTrapped) return 'high'
  if (input.peopleInjured && HIGH_IF_INJURED.has(reportType)) return 'high'
  if (input.peopleInjured) return 'medium'
  if (MEDIUM_BY_TYPE.has(reportType)) return 'medium'
  return 'low'
}
