import localforage from 'localforage'
import type { ReportType, Severity } from '@bantayog/shared-types'

export interface StoredReport {
  publicRef: string
  secret: string
  reportType: ReportType
  severity: Severity
  lat: number
  lng: number
  submittedAt: number
  reportId?: string
}

const KEY = 'bantayog:reports:v1'

function isStoredReport(value: unknown): value is StoredReport {
  if (!value || typeof value !== 'object') return false
  const report = value as Record<string, unknown>
  const lat = Number(report.lat)
  const lng = Number(report.lng)
  const submittedAt = Number(report.submittedAt)
  return (
    typeof report.publicRef === 'string' &&
    typeof report.secret === 'string' &&
    typeof report.reportType === 'string' &&
    typeof report.severity === 'string' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Number.isFinite(submittedAt) &&
    (report.reportId === undefined || typeof report.reportId === 'string')
  )
}

export async function loadReports(): Promise<StoredReport[]> {
  try {
    const raw = await localforage.getItem<unknown>(KEY)
    if (raw === null) return []
    if (!Array.isArray(raw) || !raw.every(isStoredReport)) {
      console.error('Ignoring invalid stored report payload from localforage')
      return []
    }
    return raw
  } catch (err: unknown) {
    console.error('Failed to load reports from localforage', err)
    return []
  }
}

export async function saveReport(report: Omit<StoredReport, 'reportId'>): Promise<void> {
  const all = await loadReports()
  const idx = all.findIndex((r) => r.publicRef === report.publicRef)
  if (idx >= 0) {
    const existing = all[idx]
    all[idx] = { ...existing, ...report }
  } else {
    all.push(report)
  }
  await localforage.setItem(KEY, all)
}

export async function updateReportId(publicRef: string, reportId: string): Promise<void> {
  const all = await loadReports()
  const idx = all.findIndex((r) => r.publicRef === publicRef)
  if (idx < 0) return
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const existing = all[idx]!
  all[idx] = { ...existing, reportId }
  await localforage.setItem(KEY, all)
}
