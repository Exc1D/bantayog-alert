/**
 * FeedFilters Component
 *
 * Horizontal scrollable filter chips for filtering reports by status.
 * Displays count badges for each status filter.
 */

import { Filter } from 'lucide-react'

export type FilterType = 'all' | 'pending' | 'verified' | 'resolved' | 'false_alarm'

export interface FilterCount {
  all: number
  pending: number
  verified: number
  resolved: number
  false_alarm: number
}

export interface FeedFiltersProps {
  /** Currently selected filter */
  selectedFilter: FilterType
  /** Count of reports per status */
  counts: FilterCount
  /** Callback when filter is selected */
  onSelect: (filter: FilterType) => void
}

const filterConfig: Record<
  FilterType,
  { label: string; testId: string }
> = {
  all: { label: 'All', testId: 'filter-all' },
  pending: { label: 'Pending', testId: 'filter-pending' },
  verified: { label: 'Verified', testId: 'filter-verified' },
  resolved: { label: 'Resolved', testId: 'filter-resolved' },
  false_alarm: { label: 'False Alarm', testId: 'filter-false-alarm' },
}

/**
 * FeedFilters component with horizontal scrollable filter chips
 *
 * Features:
 * - Horizontal scroll with hidden scrollbar
 * - Active filter highlighting with primary color
 * - Count badges for each filter
 * - Mobile-first design with 44px touch targets
 * - Accessible button elements
 */
export function FeedFilters({
  selectedFilter,
  counts,
  onSelect,
}: FeedFiltersProps) {
  return (
    <div className="bg-white border-b border-gray-200" data-testid="feed-filters">
      {/* Header with filter icon */}
      <div className="px-4 py-3 flex items-center gap-2">
        <Filter className="w-5 h-5 text-gray-700" strokeWidth={2} />
        <h2 className="text-sm font-semibold text-gray-700">Filter by Status</h2>
      </div>

      {/* Horizontal scrollable filter list */}
      <div className="px-4 pb-3">
        <div
          className="flex gap-2 overflow-x-auto scrollbar-hide"
          data-testid="filter-list"
        >
          {(Object.keys(filterConfig) as FilterType[]).map((filter) => {
            const config = filterConfig[filter]
            const count = counts[filter as keyof FilterCount]
            const isActive = selectedFilter === filter

            return (
              <button
                key={filter}
                onClick={() => onSelect(filter)}
                data-testid={config.testId}
                aria-pressed={isActive}
                aria-label={`Filter by ${config.label}: ${count} reports`}
                className={`
                  flex items-center gap-2 px-4 py-3 min-h-[44px]
                  rounded-full font-medium text-sm
                  transition-colors duration-150
                  flex-shrink-0
                  focus:outline-none
                  focus:ring-2
                  focus:ring-primary-blue
                  focus:ring-offset-2
                  ${
                    isActive
                      ? 'bg-primary-blue text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                <span>{config.label}</span>

                {/* Count badge */}
                {count > 0 && (
                  <span
                    className={`
                      flex items-center justify-center
                      text-xs font-bold
                      w-5 h-5
                      rounded-full
                      ${
                        isActive
                          ? 'bg-white text-primary-blue'
                          : 'bg-primary-blue text-white'
                      }
                    `}
                    data-testid={`${config.testId}-count`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
