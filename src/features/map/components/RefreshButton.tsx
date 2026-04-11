import { useState, useEffect } from 'react'
import { RefreshCw, Check } from 'lucide-react'
import { formatRelativeTime } from '../utils/timeFilters'

export interface RefreshButtonProps {
  /** Whether data is currently loading or refreshing */
  isRefreshing: boolean
  /** Function to call when refresh button is clicked */
  onRefresh: () => void
  /** Timestamp of last successful refresh (null if never refreshed) */
  lastUpdated: number | null
  /** Optional CSS class name */
  className?: string
}

/**
 * RefreshButton - Floating button to manually refresh disaster reports.
 *
 * Features:
 * - Spins while refreshing
 * - Shows checkmark briefly on successful refresh
 * - Displays "Last updated X time ago" tooltip
 *
 * Positioned in top-right corner of map, below zoom controls.
 */
export function RefreshButton({
  isRefreshing,
  onRefresh,
  lastUpdated,
  className = '',
}: RefreshButtonProps) {
  const [showSuccess, setShowSuccess] = useState(false)

  // Show checkmark briefly after successful refresh
  useEffect(() => {
    if (!isRefreshing && showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false)
      }, 2000) // Show checkmark for 2 seconds

      return () => clearTimeout(timer)
    }
  }, [isRefreshing, showSuccess])

  const handleClick = () => {
    if (!isRefreshing) {
      onRefresh()
      // Show success feedback immediately
      setShowSuccess(true)
    }
  }

  // Build tooltip text
  const getTooltipText = () => {
    if (!lastUpdated) return 'Tap to refresh disaster reports'
    return `Last updated ${formatRelativeTime(lastUpdated)}. Tap to refresh.`
  }

  const tooltipText = getTooltipText()

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isRefreshing}
        aria-label={isRefreshing ? 'Refreshing disaster reports...' : tooltipText}
        title={tooltipText}
        className={`
          flex items-center justify-center
          w-10 h-10
          bg-white
          rounded-lg
          shadow-lg
          hover:bg-gray-50
          active:bg-gray-100
          transition-all
          duration-150
          focus:outline-none
          focus:ring-2
          focus:ring-primary-blue
          focus:ring-offset-2
          disabled:opacity-70
          disabled:cursor-not-allowed
          ${showSuccess ? 'ring-2 ring-green-500 ring-offset-2' : ''}
        `}
        data-testid="refresh-button"
      >
        {showSuccess ? (
          <Check className="w-5 h-5 text-green-600" strokeWidth={2.5} data-testid="check-icon" />
        ) : (
          <RefreshCw
            className={`w-5 h-5 text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`}
            strokeWidth={2.5}
            data-testid="refresh-icon"
          />
        )}
      </button>

      {/* Optional: Show last updated text below button on hover */}
      {lastUpdated && !isRefreshing && (
        <div
          className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1
                     bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0
                     hover:opacity-100 group-hover:opacity-100 transition-opacity pointer-events-none"
          data-testid="last-updated-tooltip"
        >
          {formatRelativeTime(lastUpdated)}
        </div>
      )}
    </div>
  )
}
