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

export async function loadReports(): Promise<StoredReport[]> {
  return (await localforage.getItem<StoredReport[]>(KEY)) ?? []
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
  const existing = all[idx]
  all[idx] = { ...existing, reportId }
  await localforage.setItem(KEY, all)
}
