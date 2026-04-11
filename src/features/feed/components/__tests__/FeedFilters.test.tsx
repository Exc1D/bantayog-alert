/**
 * FeedFilters Component Tests
 *
 * Tests the status filter chips component with counts and active states.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedFilters, type FilterCount, type FilterType } from '../FeedFilters'

const mockCounts: FilterCount = {
  all: 50,
  pending: 45,
  verified: 38,
  resolved: 62,
  false_alarm: 5,
}

describe('FeedFilters', () => {
  describe('rendering', () => {
    it('should render all filter buttons', () => {
      const mockOnSelect = vi.fn()
      render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      expect(screen.getByTestId('filter-all')).toBeInTheDocument()
      expect(screen.getByTestId('filter-pending')).toBeInTheDocument()
      expect(screen.getByTestId('filter-verified')).toBeInTheDocument()
      expect(screen.getByTestId('filter-resolved')).toBeInTheDocument()
      expect(screen.getByTestId('filter-false-alarm')).toBeInTheDocument()
    })

    it('should render header with filter icon', () => {
      const mockOnSelect = vi.fn()
      render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      expect(screen.getByText('Filter by Status')).toBeInTheDocument()
    })

    it('should display count badges for each filter', () => {
      const mockOnSelect = vi.fn()
      render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      expect(screen.getByTestId('filter-all-count')).toHaveTextContent('50')
      expect(screen.getByTestId('filter-pending-count')).toHaveTextContent('45')
      expect(screen.getByTestId('filter-verified-count')).toHaveTextContent('38')
      expect(screen.getByTestId('filter-resolved-count')).toHaveTextContent('62')
      expect(screen.getByTestId('filter-false-alarm-count')).toHaveTextContent('5')
    })

    it('should hide count badge when count is zero', () => {
      const mockOnSelect = vi.fn()
      const zeroCounts: FilterCount = {
        all: 0,
        pending: 0,
        verified: 0,
        resolved: 0,
        false_alarm: 0,
      }

      render(
        <FeedFilters
          selectedFilter="all"
          counts={zeroCounts}
          onSelect={mockOnSelect}
        />
      )

      expect(screen.queryByTestId('filter-pending-count')).not.toBeInTheDocument()
    })

    it('should display 99+ for counts over 99', () => {
      const mockOnSelect = vi.fn()
      const highCounts: FilterCount = {
        all: 150,
        pending: 100,
        verified: 200,
        resolved: 99,
        false_alarm: 0,
      }

      render(
        <FeedFilters
          selectedFilter="all"
          counts={highCounts}
          onSelect={mockOnSelect}
        />
      )

      expect(screen.getByTestId('filter-pending-count')).toHaveTextContent('99+')
      expect(screen.getByTestId('filter-verified-count')).toHaveTextContent('99+')
      expect(screen.getByTestId('filter-resolved-count')).toHaveTextContent('99')
    })
  })

  describe('active state', () => {
    it('should highlight selected filter with primary color', () => {
      const mockOnSelect = vi.fn()
      const { container } = render(
        <FeedFilters
          selectedFilter="verified"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const verifiedButton = screen.getByTestId('filter-verified')
      expect(verifiedButton).toHaveClass('bg-primary-blue', 'text-white')
    })

    it('should not highlight inactive filters', () => {
      const mockOnSelect = vi.fn()
      const { container } = render(
        <FeedFilters
          selectedFilter="verified"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const pendingButton = screen.getByTestId('filter-pending')
      expect(pendingButton).toHaveClass('bg-gray-100', 'text-gray-700')
    })

    it('should invert count badge color for active filter', () => {
      const mockOnSelect = vi.fn()
      render(
        <FeedFilters
          selectedFilter="verified"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const activeBadge = screen.getByTestId('filter-verified-count')
      expect(activeBadge).toHaveClass('bg-white', 'text-primary-blue')

      const inactiveBadge = screen.getByTestId('filter-pending-count')
      expect(inactiveBadge).toHaveClass('bg-primary-blue', 'text-white')
    })
  })

  describe('interaction', () => {
    it('should call onSelect with filter type when clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelect = vi.fn()

      render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const pendingButton = screen.getByTestId('filter-pending')
      await user.click(pendingButton)

      expect(mockOnSelect).toHaveBeenCalledTimes(1)
      expect(mockOnSelect).toHaveBeenCalledWith('pending')
    })

    it('should switch to different filter when clicked', async () => {
      const user = userEvent.setup()
      const mockOnSelect = vi.fn()

      render(
        <FeedFilters
          selectedFilter="verified"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const allButton = screen.getByTestId('filter-all')
      await user.click(allButton)

      expect(mockOnSelect).toHaveBeenCalledWith('all')
    })

    it('should handle all filter types', async () => {
      const user = userEvent.setup()
      const mockOnSelect = vi.fn()

      render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const filters: FilterType[] = [
        'all',
        'pending',
        'verified',
        'resolved',
        'false_alarm',
      ]

      for (const filter of filters) {
        const button = screen.getByTestId(`filter-${filter.replace('_', '-')}`)
        await user.click(button)
        expect(mockOnSelect).toHaveBeenCalledWith(filter)
      }
    })
  })

  describe('accessibility', () => {
    it('should have aria-pressed for active filter', () => {
      const mockOnSelect = vi.fn()
      render(
        <FeedFilters
          selectedFilter="verified"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const activeButton = screen.getByTestId('filter-verified')
      expect(activeButton).toHaveAttribute('aria-pressed', 'true')

      const inactiveButton = screen.getByTestId('filter-pending')
      expect(inactiveButton).toHaveAttribute('aria-pressed', 'false')
    })

    it('should have accessible labels with counts', () => {
      const mockOnSelect = vi.fn()
      render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const verifiedButton = screen.getByTestId('filter-verified')
      expect(verifiedButton).toHaveAttribute(
        'aria-label',
        'Filter by Verified: 38 reports'
      )
    })

    it('should have minimum touch target size of 44px', () => {
      const mockOnSelect = vi.fn()
      render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const button = screen.getByTestId('filter-all')
      expect(button).toHaveClass('min-h-[44px]')
    })
  })

  describe('styling', () => {
    it('should apply horizontal scroll styles', () => {
      const mockOnSelect = vi.fn()
      const { container } = render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const filterList = screen.getByTestId('filter-list')
      expect(filterList).toHaveClass('overflow-x-auto', 'scrollbar-hide')
    })

    it('should apply focus ring for keyboard navigation', () => {
      const mockOnSelect = vi.fn()
      render(
        <FeedFilters
          selectedFilter="all"
          counts={mockCounts}
          onSelect={mockOnSelect}
        />
      )

      const button = screen.getByTestId('filter-all')
      expect(button).toHaveClass(
        'focus:ring-2',
        'focus:ring-primary-blue',
        'focus:ring-offset-2'
      )
    })
  })
})
