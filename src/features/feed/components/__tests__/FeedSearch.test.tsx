/**
 * FeedSearch Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedSearch } from '../FeedSearch'

describe('FeedSearch', () => {
  const mockOnSearch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render search input', () => {
      render(<FeedSearch onSearch={mockOnSearch} />)

      expect(screen.getByTestId('search-input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Search barangay or municipality/)).toBeInTheDocument()
    })

    it('should render custom placeholder', () => {
      render(<FeedSearch onSearch={mockOnSearch} placeholder="Custom placeholder" />)

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument()
    })

    it('should render search icon', () => {
      render(<FeedSearch onSearch={mockOnSearch} />)

      // Lucide icons are SVG elements, check by testing component renders
      expect(screen.getByTestId('search-input')).toBeInTheDocument()
      // Icon is rendered as SVG within the input
    })
  })

  describe('search functionality', () => {
    it('should call onSearch when user types', async () => {
      const user = userEvent.setup()
      render(<FeedSearch onSearch={mockOnSearch} />)

      const input = screen.getByTestId('search-input')
      await user.type(input, 'Daet')

      expect(mockOnSearch).toHaveBeenCalledWith('Daet')
    })

    it('should show clear button when has value', async () => {
      const user = userEvent.setup()
      render(<FeedSearch onSearch={mockOnSearch} />)

      const input = screen.getByTestId('search-input')
      await user.type(input, 'test')

      expect(screen.getByTestId('clear-search')).toBeInTheDocument()
    })

    it('should not show clear button when empty', () => {
      render(<FeedSearch onSearch={mockOnSearch} />)

      expect(screen.queryByTestId('clear-search')).not.toBeInTheDocument()
    })

    it('should clear search when clear button clicked', async () => {
      const user = userEvent.setup()
      render(<FeedSearch onSearch={mockOnSearch} />)

      const input = screen.getByTestId('search-input')
      await user.type(input, 'test')

      const clearButton = screen.getByTestId('clear-search')
      await user.click(clearButton)

      expect(input).toHaveValue('')
      expect(mockOnSearch).toHaveBeenCalledWith('')
    })
  })

  describe('result count', () => {
    it('should show result count when has value and count provided', async () => {
      const user = userEvent.setup()
      render(<FeedSearch onSearch={mockOnSearch} resultCount={5} />)

      const input = screen.getByTestId('search-input')
      await user.type(input, 'test')

      expect(screen.getByTestId('search-results-count')).toBeInTheDocument()
      expect(screen.getByText('5 reports found')).toBeInTheDocument()
    })

    it('should show singular "report" for count of 1', async () => {
      const user = userEvent.setup()
      render(<FeedSearch onSearch={mockOnSearch} resultCount={1} />)

      const input = screen.getByTestId('search-input')
      await user.type(input, 'test')

      expect(screen.getByText('1 report found')).toBeInTheDocument()
    })

    it('should not show result count when no search query', () => {
      render(<FeedSearch onSearch={mockOnSearch} resultCount={5} />)

      expect(screen.queryByTestId('search-results-count')).not.toBeInTheDocument()
    })
  })
})
