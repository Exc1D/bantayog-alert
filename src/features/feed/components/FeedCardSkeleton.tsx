/**
 * FeedCardSkeleton Component
 *
 * Loading skeleton for report cards in the feed.
 * Matches the shape of report cards for smooth loading transitions.
 */

export function FeedCardSkeleton() {
  return (
    <div
      className="bg-white rounded-lg p-4 animate-pulse"
      data-testid="feed-card-skeleton"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gray-200 rounded-full" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  )
}
