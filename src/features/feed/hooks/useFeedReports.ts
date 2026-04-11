/**
 * useFeedReports Hook
 *
 * Fetches reports for the feed with infinite scroll pagination.
 * Uses TanStack Query's useInfiniteQuery for optimal performance.
 */

import { useInfiniteQuery } from '@tanstack/react-query'
import { getCollection } from '@/shared/services/firestore.service'
import { where, orderBy, limit } from 'firebase/firestore'
import { Report } from '@/shared/types/firestore.types'
import { FeedReport, FeedPageResponse } from '../types'

const PAGE_SIZE = 10

export interface UseFeedReportsOptions {
  enabled?: boolean
}

export interface UseFeedReportsResult {
  data: FeedReport[] | undefined
  isLoading: boolean
  isRefetching: boolean
  isError: boolean
  error: unknown
  refetch: () => void
  hasNextPage: boolean
  fetchNextPage: () => void
  isFetchingNextPage: boolean
}

/**
 * Fetches feed reports with infinite scroll pagination
 *
 * @param options - Query options
 * @returns Feed reports and pagination controls
 */
export function useFeedReports(
  options: UseFeedReportsOptions = {}
): UseFeedReportsResult {
  const { enabled = true } = options

  const query = useInfiniteQuery({
    queryKey: ['feed-reports'],
    queryFn: async ({ pageParam = 0 }) => {
      return fetchFeedReports(pageParam)
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // Continue if we got a full page
      if (lastPage.reports.length === PAGE_SIZE) {
        return allPages.length
      }
      return undefined
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })

  // Flatten pages into single array
  const reports = query.data?.pages.flatMap((page) => page.reports)

  return {
    data: reports,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}

/**
 * Fetches a single page of reports
 *
 * @param page - Page number to fetch
 * @returns Page of feed reports
 */
async function fetchFeedReports(page: number): Promise<FeedPageResponse> {
  // Fetch verified reports ordered by creation date (newest first)
  const constraints = [
    where('status', 'in', ['verified', 'assigned', 'responding', 'resolved']),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE),
  ]

  const reports = await getCollection<Report>('reports', constraints)

  // Transform to feed format
  const feedReports = reports.map(transformToFeedReport)

  return {
    reports: feedReports,
    nextPage: feedReports.length === PAGE_SIZE ? page + 1 : null,
    totalCount: feedReports.length,
  }
}

/**
 * Transforms a Report to FeedReport for display
 *
 * @param report - Firestore report document
 * @returns Feed report with display properties
 */
function transformToFeedReport(report: Report): FeedReport {
  return {
    ...report,
    timeAgo: formatTimeAgo(report.createdAt),
    locationDisplay: formatLocation(report.approximateLocation),
    typeDisplay: formatIncidentType(report.incidentType),
    isVerified: report.status !== 'pending',
  }
}

/**
 * Formats timestamp to relative time string
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string (e.g., "2h ago")
 */
function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

/**
 * Formats location for display
 *
 * @param location - Approximate location
 * @returns Formatted location string
 */
function formatLocation(location: {
  barangay: string
  municipality: string
}): string {
  return `${location.barangay}, ${location.municipality}`
}

/**
 * Formats incident type for display
 *
 * @param type - Incident type
 * @returns Display-formatted incident type
 */
function formatIncidentType(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
