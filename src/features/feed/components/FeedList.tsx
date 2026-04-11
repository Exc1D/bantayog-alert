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
import { FeedCard } from './FeedCard'
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

  // Empty state (guard: don't show empty message when feed is intentionally disabled)
  if (!enabled) return null

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
