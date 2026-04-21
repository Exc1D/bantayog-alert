import type { ReportStatus } from '@bantayog/shared-types'
import type { ReportData } from '../hooks/useReport'

export function mapReportFromFirestore(data: Record<string, unknown>): ReportData {
  return {
    id: data.id as string,
    status: data.status as ReportStatus,
    timeline: (data.timeline as ReportData['timeline']) || [],
    type: data.type as string | undefined,
    severity: data.severity as string | undefined,
    createdAt: data.createdAt as number | undefined,
    updatedAt: data.updatedAt as number | undefined,
  }
}
