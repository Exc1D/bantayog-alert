/**
 * Feed feature types
 *
 * Extends base Report types with feed-specific display formats
 */

import { Report } from '@/shared/types/firestore.types'

/**
 * Feed report display format
 * Extends base Report with computed properties for UI display
 */
export interface FeedReport extends Report {
  // Computed display properties
  timeAgo: string
  locationDisplay: string
  typeDisplay: string
  isVerified: boolean
}

/**
 * Pagination parameters for infinite scroll
 */
export interface FeedPaginationParams {
  page: number
  limit: number
}

/**
 * Paginated feed response
 */
export interface FeedPageResponse {
  reports: FeedReport[]
  nextPage: number | null
  totalCount: number
}
