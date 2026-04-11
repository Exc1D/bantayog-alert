import { useQuery } from '@tanstack/react-query'
import { getCollection } from '@/shared/services/firestore.service'
import { where, orderBy } from 'firebase/firestore'
import { DisasterReport } from '../types'
import { Report } from '@/shared/types/firestore.types'

export interface DisasterReportsResult {
  data: DisasterReport[] | undefined
  isLoading: boolean
  isRefetching: boolean
  error: unknown
  refetch: () => void
  lastUpdated: number | null
}

/**
 * Fetches verified disaster reports from Firestore.
 * Filters for verified and active reports only.
 *
 * @param enabled - Whether the query should be enabled
 * @returns Query result with disaster reports and refresh controls
 */
export function useDisasterReports(enabled = true): DisasterReportsResult {
  const query = useQuery({
    queryKey: ['disaster-reports'],
    queryFn: async () => {
      // Fetch verified reports that are not resolved or false alarm
      const reports = await getCollection<Report>(
        'reports',
        [
          where('status', 'in', ['verified', 'assigned', 'responding']),
          orderBy('createdAt', 'desc'),
        ]
      )

      // Transform to map display format
      return reports.map(transformToDisasterReport)
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })

  // Track last successful fetch timestamp
  const lastUpdated =
    query.dataUpdatedAt > 0 ? query.dataUpdatedAt : query.data ? Date.now() : null

  return {
    data: query.data,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
    lastUpdated,
  }
}

/**
 * Transforms a Report to a DisasterReport for map display.
 *
 * @param report - Firestore report document
 * @returns Disaster report for map display
 */
function transformToDisasterReport(report: Report): DisasterReport {
  return {
    id: report.id,
    incidentType: report.incidentType,
    severity: report.severity,
    status: report.status,
    timestamp: report.createdAt,
    location: {
      latitude: report.approximateLocation.approximateCoordinates.latitude,
      longitude: report.approximateLocation.approximateCoordinates.longitude,
    },
    description: report.description,
  }
}
