import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RefreshButton } from '../RefreshButton'

describe('RefreshButton', () => {
  const mockOnRefresh = vi.fn()

  beforeEach(() => {
    mockOnRefresh.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('when not refreshing', () => {
    it('should render refresh button', () => {
      render(
        <RefreshButton
          isRefreshing={false}
          onRefresh={mockOnRefresh}
          lastUpdated={Date.now() - 5 * 60 * 1000} // 5 minutes ago
        />
      )

      const button = screen.getByRole('button', { name: /Last updated.*Tap to refresh/ })
      expect(button).toBeInTheDocument()
      expect(button).not.toBeDisabled()
    })

    it('should display refresh icon', () => {
      render(
        <RefreshButton
          isRefreshing={false}
          onRefresh={mockOnRefresh}
          lastUpdated={Date.now()}
        />
      )

      const refreshIcon = screen.getByTestId('refresh-icon')
      expect(refreshIcon).toBeInTheDocument()
      expect(refreshIcon).toHaveClass('text-gray-700')
    })

    it('should not spin refresh icon when not refreshing', () => {
      render(
        <RefreshButton isRefreshing={false} onRefresh={mockOnRefresh} lastUpdated={null} />
      )

      const refreshIcon = screen.getByTestId('refresh-icon')
      expect(refreshIcon).not.toHaveClass('animate-spin')
    })

    it('should call onRefresh when clicked', async () => {
      const user = userEvent.setup()
      render(
        <RefreshButton isRefreshing={false} onRefresh={mockOnRefresh} lastUpdated={null} />
      )

      const button = screen.getByRole('button', { name: /Tap to refresh/ })
      await user.click(button)

      expect(mockOnRefresh).toHaveBeenCalledTimes(1)
    })

    it('should show checkmark briefly after click', async () => {
      const user = userEvent.setup()
      render(
        <RefreshButton isRefreshing={false} onRefresh={mockOnRefresh} lastUpdated={null} />
      )

      const button = screen.getByRole('button')
      await user.click(button)

      // Checkmark should appear immediately
      expect(screen.getByTestId('check-icon')).toBeInTheDocument()
      expect(screen.queryByTestId('refresh-icon')).not.toBeInTheDocument()

      // Wait for the 2 second timer to complete
      await waitFor(
        () => {
          expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Refresh icon should reappear
      expect(screen.getByTestId('refresh-icon')).toBeInTheDocument()
    })
  })

  describe('when refreshing', () => {
    it('should disable button while refreshing', () => {
      render(
        <RefreshButton isRefreshing={true} onRefresh={mockOnRefresh} lastUpdated={Date.now()} />
      )

      const button = screen.getByRole('button', { name: /Refreshing/ })
      expect(button).toBeDisabled()
    })

    it('should show spinning refresh icon while refreshing', () => {
      render(
        <RefreshButton isRefreshing={true} onRefresh={mockOnRefresh} lastUpdated={Date.now()} />
      )

      const refreshIcon = screen.getByTestId('refresh-icon')
      expect(refreshIcon).toBeInTheDocument()
      expect(refreshIcon).toHaveClass('animate-spin')
    })

    it('should not call onRefresh when clicked while refreshing', async () => {
      const user = userEvent.setup()
      render(
        <RefreshButton isRefreshing={true} onRefresh={mockOnRefresh} lastUpdated={Date.now()} />
      )

      const button = screen.getByRole('button')
      await user.click(button)

      expect(mockOnRefresh).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have proper aria-label for loading state', () => {
      render(
        <RefreshButton isRefreshing={true} onRefresh={mockOnRefresh} lastUpdated={Date.now()} />
      )

      const button = screen.getByRole('button', { name: 'Refreshing disaster reports...' })
      expect(button).toBeInTheDocument()
    })

    it('should have proper aria-label for idle state with last updated', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      render(
        <RefreshButton
          isRefreshing={false}
          onRefresh={mockOnRefresh}
          lastUpdated={fiveMinutesAgo}
        />
      )

      const button = screen.getByRole('button', { name: /Last updated.*Tap to refresh/ })
      expect(button).toBeInTheDocument()
    })

    it('should have proper aria-label for idle state without last updated', () => {
      render(
        <RefreshButton isRefreshing={false} onRefresh={mockOnRefresh} lastUpdated={null} />
      )

      const button = screen.getByRole('button', { name: /Tap to refresh disaster reports/ })
      expect(button).toBeInTheDocument()
    })

    it('should have title attribute for tooltip', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      render(
        <RefreshButton
          isRefreshing={false}
          onRefresh={mockOnRefresh}
          lastUpdated={fiveMinutesAgo}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title')
      expect(button.getAttribute('title')).toContain('Last updated')
    })
  })

  describe('last updated display', () => {
    it('should not show tooltip when no last updated', () => {
      render(
        <RefreshButton isRefreshing={false} onRefresh={mockOnRefresh} lastUpdated={null} />
      )

      const tooltip = screen.queryByTestId('last-updated-tooltip')
      expect(tooltip).not.toBeInTheDocument()
    })

    it('should show tooltip when last updated exists', () => {
      render(
        <RefreshButton
          isRefreshing={false}
          onRefresh={mockOnRefresh}
          lastUpdated={Date.now()}
        />
      )

      const tooltip = screen.getByTestId('last-updated-tooltip')
      expect(tooltip).toBeInTheDocument()
    })
  })
})
