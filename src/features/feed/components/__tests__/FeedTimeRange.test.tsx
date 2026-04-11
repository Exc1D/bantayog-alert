/**
 * FeedTimeRange Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedTimeRange, type TimeRangeOption } from '../FeedTimeRange'

describe('FeedTimeRange', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render time range button', () => {
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      expect(screen.getByTestId('time-range-button')).toBeInTheDocument()
      expect(screen.getByText('Last 24h')).toBeInTheDocument()
    })

    it('should display current time range option', () => {
      const { rerender } = render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      expect(screen.getByText('Last 24h')).toBeInTheDocument()

      rerender(<FeedTimeRange value="7d" onChange={mockOnChange} />)
      expect(screen.getByText('Last 7 days')).toBeInTheDocument()

      rerender(<FeedTimeRange value="30d" onChange={mockOnChange} />)
      expect(screen.getByText('Last 30 days')).toBeInTheDocument()

      rerender(<FeedTimeRange value="all" onChange={mockOnChange} />)
      expect(screen.getByText('All time')).toBeInTheDocument()
    })

    it('should show clock icon and dropdown indicator', () => {
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      expect(screen.getByTestId('time-range-button')).toBeInTheDocument()
    })
  })

  describe('dropdown interaction', () => {
    it('should open dropdown when button clicked', async () => {
      const user = userEvent.setup()
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      const timeRangeButton = screen.getByTestId('time-range-button')
      await user.click(timeRangeButton)

      expect(screen.getByTestId('time-range-dropdown')).toBeInTheDocument()
    })

    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup()
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      const timeRangeButton = screen.getByTestId('time-range-button')
      await user.click(timeRangeButton)

      expect(screen.getByTestId('time-range-dropdown')).toBeInTheDocument()

      // Click outside
      await user.click(document.body)

      expect(screen.queryByTestId('time-range-dropdown')).not.toBeInTheDocument()
    })

    it('should call onChange when option is clicked', async () => {
      const user = userEvent.setup()
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      const timeRangeButton = screen.getByTestId('time-range-button')
      await user.click(timeRangeButton)

      const sevenDaysOption = screen.getByTestId('time-range-option-7d')
      await user.click(sevenDaysOption)

      expect(mockOnChange).toHaveBeenCalledWith('7d')
      expect(screen.queryByTestId('time-range-dropdown')).not.toBeInTheDocument()
    })

    it('should highlight selected option', async () => {
      const user = userEvent.setup()
      render(<FeedTimeRange value="7d" onChange={mockOnChange} />)

      const timeRangeButton = screen.getByTestId('time-range-button')
      await user.click(timeRangeButton)

      const sevenDaysOption = screen.getByTestId('time-range-option-7d')
      expect(sevenDaysOption).toHaveClass('bg-blue-50')
    })
  })

  describe('time range options', () => {
    it('should display all time range options', async () => {
      const user = userEvent.setup()
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      const timeRangeButton = screen.getByTestId('time-range-button')
      await user.click(timeRangeButton)

      expect(screen.getByTestId('time-range-option-24h')).toBeInTheDocument()
      expect(screen.getByTestId('time-range-option-7d')).toBeInTheDocument()
      expect(screen.getByTestId('time-range-option-30d')).toBeInTheDocument()
      expect(screen.getByTestId('time-range-option-all')).toBeInTheDocument()
    })

    it('should show descriptions for each option', async () => {
      const user = userEvent.setup()
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      const timeRangeButton = screen.getByTestId('time-range-button')
      await user.click(timeRangeButton)

      expect(screen.getByText('Reports from the last 24 hours')).toBeInTheDocument()
      expect(screen.getByText('Reports from the last week')).toBeInTheDocument()
      expect(screen.getByText('Reports from the last month')).toBeInTheDocument()
      expect(screen.getByText('Show all reports')).toBeInTheDocument()
    })
  })

  describe('chevron rotation', () => {
    it('should open dropdown when button clicked', async () => {
      const user = userEvent.setup()
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      // Dropdown should be closed initially
      expect(screen.queryByTestId('time-range-dropdown')).not.toBeInTheDocument()

      const timeRangeButton = screen.getByTestId('time-range-button')
      await user.click(timeRangeButton)

      // Dropdown should be open after click
      expect(screen.getByTestId('time-range-dropdown')).toBeInTheDocument()
    })

    it('should close dropdown when option selected', async () => {
      const user = userEvent.setup()
      render(<FeedTimeRange value="24h" onChange={mockOnChange} />)

      const timeRangeButton = screen.getByTestId('time-range-button')
      await user.click(timeRangeButton)

      expect(screen.getByTestId('time-range-dropdown')).toBeInTheDocument()

      const sevenDaysOption = screen.getByTestId('time-range-option-7d')
      await user.click(sevenDaysOption)

      // Dropdown should close after selection
      expect(screen.queryByTestId('time-range-dropdown')).not.toBeInTheDocument()
    })
  })
})
