import type { ReportStatus } from '@bantayog/shared-types'
import type { ReportData } from '../hooks/useReport'

export function mapReportFromFirestore(data: Record<string, unknown>): ReportData {
  if (!data.id || !data.status) {
    throw new Error('Invalid report data: missing required fields')
  }

  const result: ReportData = {
    id: data.id as string,
    status: data.status as ReportStatus,
    timeline: data.timeline as ReportData['timeline'],
  };

  if (data.type !== undefined) {
    result.type = data.type as string;
  }
  if (data.reportType !== undefined) {
    result.reportType = data.reportType as string;
  }
  if (data.severity !== undefined) {
    result.severity = data.severity as string;
  }
  if (data.createdAt !== undefined) {
    result.createdAt = data.createdAt as number;
  }
  if (data.updatedAt !== undefined) {
    result.updatedAt = data.updatedAt as number;
  }
  if (data.location !== undefined) {
    const loc = data.location as Record<string, unknown>;
    result.location = {
      ...(loc.address !== undefined && { address: loc.address as string }),
      ...(loc.lat !== undefined && { lat: loc.lat as number }),
      ...(loc.lng !== undefined && { lng: loc.lng as number }),
    };
  }
  if (data.reporterName !== undefined) {
    result.reporterName = data.reporterName as string;
  }
  if (data.reporterPhone !== undefined) {
    result.reporterPhone = data.reporterPhone as string;
  }
  if (data.resolutionNote !== undefined) {
    result.resolutionNote = data.resolutionNote as string;
  }
  if (data.closedBy !== undefined) {
    result.closedBy = data.closedBy as string;
  }

  return result;
}
