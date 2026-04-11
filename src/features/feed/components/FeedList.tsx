/**
 * FeedList Component
 *
 * Facebook-style timeline feed for browsing disaster reports.
 * Features pull-to-refresh, infinite scroll, and multiple loading states.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { useFeedReports } from '../hooks/useFeedReports'
import { FeedCardSkeleton } from './FeedCardSkeleton'
import { FeedCard } from './FeedCard'
import { FeedFilters, type FilterType } from './FeedFilters'
import { FeedSearch } from './FeedSearch'
import { FeedSort, type SortOption } from './FeedSort'
import { FeedTimeRange, type TimeRangeOption } from './FeedTimeRange'
import { Button } from '@/shared/components/Button'

export interface FeedListProps {
  /** Enable/disable the feed query */
  enabled?: boolean
}

export function FeedList({ enabled = true }: FeedListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('all')

  const {
    data,
    isLoading,
    isRefetching,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useFeedReports({ enabled })

  // Calculate filter counts from all loaded reports
  const allReports = data?.pages?.flatMap((page) => page.data ?? []) ?? []
  const filterCounts = {
    all: allReports.length,
    pending: allReports.filter((r) => r.status === 'pending').length,
    verified: allReports.filter((r) => r.status === 'verified').length,
    resolved: allReports.filter((r) => r.status === 'resolved').length,
    false_alarm: allReports.filter((r) => r.status === 'false_alarm').length,
  }

  // Calculate time range threshold
  const timeRangeThreshold = useMemo(() => {
    const now = Date.now()
    switch (timeRange) {
      case '24h':
        return now - 24 * 60 * 60 * 1000 // 24 hours ago
      case '7d':
        return now - 7 * 24 * 60 * 60 * 1000 // 7 days ago
      case '30d':
        return now - 30 * 24 * 60 * 60 * 1000 // 30 days ago
      case 'all':
      default:
        return 0 // Show all
    }
  }, [timeRange])

  // Filter and search reports
  const filteredAndSearchedReports = useMemo(() => {
    return allReports.filter((report) => {
      // Apply status filter
      if (selectedFilter !== 'all' && report.status !== selectedFilter) {
        return false
      }

      // Apply time range filter
      if (timeRangeThreshold > 0 && report.createdAt < timeRangeThreshold) {
        return false
      }

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const { barangay, municipality } = report.approximateLocation
        const matchesLocation =
          barangay?.toLowerCase().includes(query) ||
          municipality?.toLowerCase().includes(query)
        const matchesType = report.incidentType.toLowerCase().includes(query)
        const matchesDesc = report.description.toLowerCase().includes(query)

        return matchesLocation || matchesType || matchesDesc
      }

      return true
    })
  }, [allReports, selectedFilter, searchQuery, timeRangeThreshold])

  // Sort reports
  const displayReports = useMemo(() => {
    const sorted = [...filteredAndSearchedReports]

    switch (sortBy) {
      case 'severity':
        return sorted.sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
          const severityA = severityOrder[a.severity as keyof typeof severityOrder] ?? 99
          const severityB = severityOrder[b.severity as keyof typeof severityOrder] ?? 99
          return severityA - severityB
        })

      case 'status':
        return sorted.sort((a, b) => {
          const statusOrder = { pending: 0, verified: 1, resolved: 2, false_alarm: 3 }
          const statusA = statusOrder[a.status] ?? 99
          const statusB = statusOrder[b.status] ?? 99
          return statusA - statusB
        })

      case 'recent':
      default:
        return sorted.sort((a, b) => b.createdAt - a.createdAt)
    }
  }, [filteredAndSearchedReports, sortBy])

  // Infinite scroll observer
  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0, rootMargin: '100px' }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Initial loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 pb-20" data-testid="feed-list">
        <div className="max-w-lg mx-auto bg-gray-100 min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
            <h1 className="text-xl font-bold text-gray-900">Bantayog Feed</h1>
          </div>

          {/* Skeleton cards */}
          <div className="p-4 space-y-4">
            <FeedCardSkeleton />
            <FeedCardSkeleton />
            <FeedCardSkeleton />
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-gray-100 pb-20" data-testid="feed-list">
        <div className="max-w-lg mx-auto bg-gray-100 min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
            <h1 className="text-xl font-bold text-gray-900">Bantayog Feed</h1>
          </div>

          {/* Error banner */}
          <div className="p-4">
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
              data-testid="feed-error"
            >
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-red-900 mb-2">
                Unable to load reports
              </h2>
              <p className="text-red-700 mb-4">
                Something went wrong while fetching the feed. Please try again.
              </p>
              <div className="flex justify-center">
                <Button
                  variant="primary"
                  onClick={() => refetch()}
                  disabled={isLoading}
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Empty state (guard: don't show empty message when feed is intentionally disabled)
  if (!enabled) return null

  if (!data || allReports.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 pb-20" data-testid="feed-list">
        <div className="max-w-lg mx-auto bg-gray-100 min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
            <h1 className="text-xl font-bold text-gray-900">Bantayog Feed</h1>
          </div>

          {/* Empty state illustration */}
          <div className="p-4">
            <div
              className="bg-white rounded-lg p-8 text-center"
              data-testid="feed-empty"
            >
              <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No reports yet
              </h2>
              <p className="text-gray-600 mb-4">
                Be the first to report an incident in your area!
              </p>
              <Button variant="primary" disabled>
                Report Incident
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show empty state when filter matches no reports
  if (displayReports.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 pb-20" data-testid="feed-list">
        <div className="max-w-lg mx-auto bg-gray-100 min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
            <h1 className="text-xl font-bold text-gray-900">Bantayog Feed</h1>
          </div>

          {/* Filtered empty state */}
          <div className="p-4">
            <div className="bg-white rounded-lg p-8 text-center" data-testid="feed-empty">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No reports match this filter
              </h2>
              <p className="text-gray-600">
                Try selecting a different filter or check back later.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success state with feed
  return (
    <div className="min-h-screen bg-gray-100 pb-20" data-testid="feed-list">
      <div className="max-w-lg mx-auto bg-gray-100 min-h-screen">
        {/* Header with pull-to-refresh indicator */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 space-y-3">
          {/* Title row with sort and time range */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold text-gray-900">Bantayog Feed</h1>
            <div className="flex items-center gap-2">
              <FeedTimeRange value={timeRange} onChange={setTimeRange} />
              <FeedSort value={sortBy} onChange={setSortBy} reportCount={displayReports.length} />
            </div>
          </div>

          {/* Search bar */}
          <FeedSearch
            onSearch={setSearchQuery}
            resultCount={displayReports.length}
          />

          {/* Status filters */}
          <FeedFilters
            selectedFilter={selectedFilter}
            counts={filterCounts}
            onSelect={setSelectedFilter}
          />
        </div>

        {/* Story cards section (placeholder for future) */}
        <div className="bg-white border-b border-gray-200 p-4 mb-2">
          <div
            className="flex gap-4 overflow-x-auto"
            data-testid="story-cards-placeholder"
          >
            <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg" />
            <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg" />
            <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg" />
          </div>
        </div>

        {/* Report cards */}
        <div className="p-4 space-y-4" data-testid="feed-reports">
          {displayReports.map((report) => (
            <FeedCard key={report.id} report={report} />
          ))}

          {/* Loading more indicator */}
          {isFetchingNextPage && (
            <div className="space-y-4" data-testid="loading-more">
              <FeedCardSkeleton />
              <FeedCardSkeleton />
            </div>
          )}

          {/* Infinite scroll trigger */}
          <div ref={observerTarget} className="h-1" />
        </div>
      </div>
    </div>
  )
}
