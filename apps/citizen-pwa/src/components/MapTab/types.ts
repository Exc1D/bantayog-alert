import type { ReportType, Severity, ReportStatus } from '@bantayog/shared-types'

export interface PublicIncident {
  id: string
  reportType: ReportType
  severity: Severity
  status: ReportStatus
  barangayId: string
  municipalityLabel: string
  publicLocation: { lat: number; lng: number }
  submittedAt: number
  verifiedAt?: number
}

export interface MyReport {
  publicRef: string
  reportType: ReportType
  severity: Severity
  lat: number
  lng: number
  submittedAt: number
  id?: string
  status: ReportStatus | 'queued'
  municipalityLabel?: string
  lastStatusAt?: number
}

export interface Filters {
  severity: 'all' | 'high' | 'medium' | 'low'
  window: '24h' | '7d' | '30d'
}
