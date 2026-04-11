/**
 * Feed Feature Barrel Exports
 *
 * Public API for the feed feature domain.
 */

// Components
export { FeedList } from './components/FeedList'
export type { FeedListProps } from './components/FeedList'
export { FeedCard } from './components/FeedCard'
export type { FeedCardProps } from './components/FeedCard'
export { FeedCardSkeleton } from './components/FeedCardSkeleton'
export { EmptyState } from './components/EmptyState'

// Hooks
export { useFeedReports } from './hooks/useFeedReports'
export type { UseFeedReportsResult } from './hooks/useFeedReports'

// Types
export type { FeedReport, FeedPaginationParams, FeedPageResponse, FeedCardActions } from './types'

// Utils
export { truncateText, formatReportType, formatLocationName, formatTimeAgo } from './utils/feedHelpers'
