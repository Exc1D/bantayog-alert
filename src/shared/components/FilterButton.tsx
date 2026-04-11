import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Filter } from 'lucide-react'

export interface FilterButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Number of active filters to display as badge */
  activeFilterCount?: number
  /** Accessibility label */
  'aria-label': string
}

/**
 * Filter button with badge showing count of active filters.
 * Consistent styling with map control buttons.
 *
 * @param onClick - Handler for button click
 * @param activeFilterCount - Number of active filters (shows as badge)
 * @param ariaLabel - Accessibility label
 * @param disabled - Whether button is disabled
 */
export const FilterButton = forwardRef<HTMLButtonElement, FilterButtonProps>(
  ({ activeFilterCount = 0, 'aria-label': ariaLabel, disabled = false, className = '', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        className={`
          relative flex items-center justify-center
          w-10 h-10
          bg-white
          rounded-lg
          shadow-lg
          hover:bg-gray-50
          active:bg-gray-100
          transition-colors
          duration-150
          focus:outline-none
          focus:ring-2
          focus:ring-primary-blue
          focus:ring-offset-2
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${className}
        `}
        data-testid="filter-button"
        {...props}
      >
        <Filter className="w-5 h-5 text-gray-700" strokeWidth={2} />

        {/* Badge for active filters */}
        {activeFilterCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center
              bg-primary-blue text-white
              text-xs font-bold
              w-5 h-5
              rounded-full
              border-2 border-white"
            data-testid="filter-badge"
          >
            {activeFilterCount > 9 ? '9+' : activeFilterCount}
          </span>
        )}
      </button>
    )
  }
)

FilterButton.displayName = 'FilterButton'
