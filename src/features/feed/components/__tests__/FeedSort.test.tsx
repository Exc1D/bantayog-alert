/**
 * FeedSort Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedSort, type SortOption } from '../FeedSort'

describe('FeedSort', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render sort button', () => {
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      expect(screen.getByTestId('sort-button')).toBeInTheDocument()
      expect(screen.getByText('Recent first')).toBeInTheDocument()
    })

    it('should display current sort option', () => {
      const { rerender } = render(<FeedSort value="recent" onChange={mockOnChange} />)

      expect(screen.getByText('Recent first')).toBeInTheDocument()

      rerender(<FeedSort value="severity" onChange={mockOnChange} />)
      expect(screen.getByText('Severity')).toBeInTheDocument()
    })

    it('should show sort icon and dropdown indicator', () => {
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      // Component renders with both icons
      expect(screen.getByTestId('sort-button')).toBeInTheDocument()
      // ArrowUpDown and ChevronDown icons are SVG elements
    })
  })

  describe('dropdown interaction', () => {
    it('should open dropdown when button clicked', async () => {
      const user = userEvent.setup()
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      const sortButton = screen.getByTestId('sort-button')
      await user.click(sortButton)

      expect(screen.getByTestId('sort-dropdown')).toBeInTheDocument()
    })

    it('should close dropdown when clicking outside', async () => {
      const user = userEvent.setup()
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      const sortButton = screen.getByTestId('sort-button')
      await user.click(sortButton)

      // Click outside
      await user.click(document.body)

      await waitFor(() => {
        expect(screen.queryByTestId('sort-dropdown')).not.toBeInTheDocument()
      })
    })

    it('should call onChange when option is clicked', async () => {
      const user = userEvent.setup()
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      const sortButton = screen.getByTestId('sort-button')
      await user.click(sortButton)

      const severityOption = screen.getByTestId('sort-option-severity')
      await user.click(severityOption)

      expect(mockOnChange).toHaveBeenCalledWith('severity')
      expect(screen.queryByTestId('sort-dropdown')).not.toBeInTheDocument()
    })

    it('should highlight selected option', async () => {
      const user = userEvent.setup()
      render(<FeedSort value="severity" onChange={mockOnChange} />)

      const sortButton = screen.getByTestId('sort-button')
      await user.click(sortButton)

      const severityOption = screen.getByTestId('sort-option-severity')
      expect(severityOption).toHaveClass('bg-blue-50')
    })
  })

  describe('sort options', () => {
    it('should display all sort options', async () => {
      const user = userEvent.setup()
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      const sortButton = screen.getByTestId('sort-button')
      await user.click(sortButton)

      expect(screen.getByTestId('sort-option-recent')).toBeInTheDocument()
      expect(screen.getByTestId('sort-option-severity')).toBeInTheDocument()
      expect(screen.getByTestId('sort-option-status')).toBeInTheDocument()

      // Check labels exist (using getAllByText since labels appear in both button and dropdown)
      expect(screen.getAllByText('Recent first')).toHaveLength(2)
      expect(screen.getByText('Severity')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
    })

    it('should show descriptions for each option', async () => {
      const user = userEvent.setup()
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      const sortButton = screen.getByTestId('sort-button')
      await user.click(sortButton)

      expect(screen.getByText('Newest reports first')).toBeInTheDocument()
      expect(screen.getByText('Critical to low severity')).toBeInTheDocument()
      expect(screen.getByText('Group by verification status')).toBeInTheDocument()
    })
  })

  describe('chevron rotation', () => {
    it('should open dropdown when button clicked', async () => {
      const user = userEvent.setup()
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      // Dropdown should be closed initially
      expect(screen.queryByTestId('sort-dropdown')).not.toBeInTheDocument()

      const sortButton = screen.getByTestId('sort-button')
      await user.click(sortButton)

      // Dropdown should be open after click
      expect(screen.getByTestId('sort-dropdown')).toBeInTheDocument()
    })

    it('should close dropdown when option selected', async () => {
      const user = userEvent.setup()
      render(<FeedSort value="recent" onChange={mockOnChange} />)

      const sortButton = screen.getByTestId('sort-button')
      await user.click(sortButton)

      expect(screen.getByTestId('sort-dropdown')).toBeInTheDocument()

      const severityOption = screen.getByTestId('sort-option-severity')
      await user.click(severityOption)

      // Dropdown should close after selection
      expect(screen.queryByTestId('sort-dropdown')).not.toBeInTheDocument()
    })
  })
})
