/**
 * FeedList Component
 *
 * Facebook-style timeline feed for browsing disaster reports.
 * Features pull-to-refresh, infinite scroll, and multiple loading states.
 */

import { useEffect, useRef } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { useFeedReports } from '../hooks/useFeedReports'
import { FeedCardSkeleton } from './FeedCardSkeleton'
import { Button } from '@/shared/components/Button'

export interface FeedListProps {
  /** Enable/disable the feed query */
  enabled?: boolean
}

export function FeedList({ enabled = true }: FeedListProps) {
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

  // Infinite scroll observer
  const observerTarget = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 1.0 }
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
              <Button
                variant="primary"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!data || data.length === 0) {
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

  // Success state with feed
  return (
    <div className="min-h-screen bg-gray-100 pb-20" data-testid="feed-list">
      <div className="max-w-lg mx-auto bg-gray-100 min-h-screen">
        {/* Header with pull-to-refresh indicator */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Bantayog Feed</h1>
            {isRefetching && (
              <RefreshCw
                className="w-5 h-5 text-primary-blue animate-spin"
                data-testid="refresh-indicator"
              />
            )}
          </div>
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
          {data.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-lg p-4 shadow-sm"
              data-testid={`feed-report-${report.id}`}
            >
              {/* Report header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-blue rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {report.typeDisplay.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">
                        {report.typeDisplay}
                      </span>
                      {report.isVerified && (
                        <span
                          className="text-xs px-2 py-0.5 bg-status-verified text-white rounded-full"
                          data-testid="verified-badge"
                        >
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{report.timeAgo}</div>
                  </div>
                </div>
                <div
                  className={`text-xs font-bold px-2 py-1 rounded ${getSeverityColor(report.severity)}`}
                  data-testid="severity-badge"
                >
                  {report.severity.toUpperCase()}
                </div>
              </div>

              {/* Report content */}
              <p className="text-gray-800 text-sm mb-3" data-testid="report-description">
                {report.description}
              </p>

              {/* Report footer */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span data-testid="report-location">{report.locationDisplay}</span>
                <span className="capitalize" data-testid="report-status">
                  {report.status.replace('_', ' ')}
                </span>
              </div>
            </div>
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

/**
 * Gets the color class for severity badge
 *
 * @param severity - Incident severity level
 * @returns Tailwind color classes
 */
function getSeverityColor(severity: string): string {
  const colors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  }
  return colors[severity as keyof typeof colors] || colors.low
}
