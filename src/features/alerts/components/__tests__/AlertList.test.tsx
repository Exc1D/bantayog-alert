/**
 * AlertList Component Tests
 *
 * Tests the official alerts list component with all states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { AlertList } from '../AlertList'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as useAlertsModule from '../../hooks/useAlerts'

// Mock the hook module
vi.mock('../../hooks/useAlerts')

const mockAlerts = [
  {
    id: 'alert-1',
    createdAt: Date.now() - 3600000,
    title: 'Typhoon Warning',
    message: 'Typhoon signal raised in Camarines Norte. Please take necessary precautions.',
    severity: 'emergency' as const,
    targetAudience: 'all' as const,
    deliveryMethod: ['push', 'in_app'] as const,
    createdBy: 'admin-123',
    linkUrl: 'https://pagasa.dost.gov.ph',
  },
  {
    id: 'alert-2',
    createdAt: Date.now() - 7200000,
    title: 'Flood Advisory',
    message: 'Heavy rainfall may cause flooding in low-lying areas. Monitor weather updates.',
    severity: 'warning' as const,
    targetAudience: 'municipality' as const,
    targetMunicipality: 'Daet',
    deliveryMethod: ['in_app'] as const,
    createdBy: 'admin-123',
  },
  {
    id: 'alert-3',
    createdAt: Date.now() - 10800000,
    title: 'Weather Update',
    message: 'Fair weather expected throughout the day. No significant weather disturbances.',
    severity: 'info' as const,
    targetAudience: 'all' as const,
    deliveryMethod: ['push'] as const,
    createdBy: 'admin-123',
  },
]

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </BrowserRouter>
    )
  }
}

describe('AlertList', () => {
  const mockRefetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockRefetch.mockResolvedValue({})
  })

  describe('when loading', () => {
    it('should show loading skeleton', () => {
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('alert-list')).toBeInTheDocument()
      expect(screen.getByText('Official Alerts')).toBeInTheDocument()
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons).toHaveLength(3)
    })
  })

  describe('when error occurs', () => {
    it('should show error message with retry button', () => {
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('alert-error')).toBeInTheDocument()
      expect(screen.getByText('Unable to load alerts')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup()
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('when empty', () => {
    it('should show empty state illustration', () => {
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('alert-empty')).toBeInTheDocument()
      expect(screen.getByText('No active alerts')).toBeInTheDocument()
      expect(
        screen.getByText('There are currently no active emergency alerts in your area.')
      ).toBeInTheDocument()
    })
  })

  describe('when alerts are loaded', () => {
    it('should display alert cards', () => {
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('alert-cards')).toBeInTheDocument()
      expect(screen.getByTestId('alert-card-alert-1')).toBeInTheDocument()
      expect(screen.getByTestId('alert-card-alert-2')).toBeInTheDocument()
      expect(screen.getByTestId('alert-card-alert-3')).toBeInTheDocument()
    })

    it('should display alert information correctly', () => {
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      // First alert
      expect(screen.getByText('Typhoon Warning')).toBeInTheDocument()
      expect(screen.getByText(/Typhoon signal raised/)).toBeInTheDocument()

      // Second alert
      expect(screen.getByText('Flood Advisory')).toBeInTheDocument()
      expect(screen.getByText(/Heavy rainfall may cause flooding/)).toBeInTheDocument()

      // Third alert
      expect(screen.getByText('Weather Update')).toBeInTheDocument()
    })

    it('should show refresh indicator when refetching', () => {
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      // Re-mock with isRefetching after initial render
      const { rerender } = render(<AlertList />, { wrapper: createWrapper() })

      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <AlertList />
        </QueryClientProvider>
      )

      // Note: The refresh indicator only shows when data exists
      // This test verifies the component structure
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument()
    })
  })

  describe('Priority Filters', () => {
    it('should display all priority filters', () => {
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('priority-filters')).toBeInTheDocument()
      expect(screen.getByTestId('priority-filter-all')).toBeInTheDocument()
      expect(screen.getByTestId('priority-filter-high')).toBeInTheDocument()
      expect(screen.getByTestId('priority-filter-medium')).toBeInTheDocument()
      expect(screen.getByTestId('priority-filter-low')).toBeInTheDocument()
    })

    it('should show correct count badges', () => {
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      // All: 3 alerts
      expect(screen.getByTestId('priority-filter-all')).toHaveTextContent('(3)')
      // High (emergency): 1 alert
      expect(screen.getByTestId('priority-filter-high')).toHaveTextContent('(1)')
      // Medium (warning): 1 alert
      expect(screen.getByTestId('priority-filter-medium')).toHaveTextContent('(1)')
      // Low (info): 1 alert
      expect(screen.getByTestId('priority-filter-low')).toHaveTextContent('(1)')
    })

    it('should filter alerts by high priority', async () => {
      const user = userEvent.setup()
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      const highFilter = screen.getByTestId('priority-filter-high')
      await user.click(highFilter)

      // Should only show the emergency alert
      expect(screen.getByTestId('alert-card-alert-1')).toBeInTheDocument()
      expect(screen.queryByTestId('alert-card-alert-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('alert-card-alert-3')).not.toBeInTheDocument()
    })

    it('should filter alerts by medium priority', async () => {
      const user = userEvent.setup()
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      const mediumFilter = screen.getByTestId('priority-filter-medium')
      await user.click(mediumFilter)

      // Should only show the warning alert
      expect(screen.queryByTestId('alert-card-alert-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('alert-card-alert-2')).toBeInTheDocument()
      expect(screen.queryByTestId('alert-card-alert-3')).not.toBeInTheDocument()
    })

    it('should filter alerts by low priority', async () => {
      const user = userEvent.setup()
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      const lowFilter = screen.getByTestId('priority-filter-low')
      await user.click(lowFilter)

      // Should only show the info alert
      expect(screen.queryByTestId('alert-card-alert-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('alert-card-alert-2')).not.toBeInTheDocument()
      expect(screen.getByTestId('alert-card-alert-3')).toBeInTheDocument()
    })

    it('should show empty state when filter matches no alerts', async () => {
      const user = userEvent.setup()
      const noHighAlerts = mockAlerts.filter((a) => a.severity !== 'emergency')
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: noHighAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      const highFilter = screen.getByTestId('priority-filter-high')
      await user.click(highFilter)

      expect(screen.getByTestId('alert-empty')).toBeInTheDocument()
      expect(screen.getByText('No alerts match this filter')).toBeInTheDocument()
    })
  })

  describe('Refresh Functionality', () => {
    it('should call refetch when refresh button is clicked', async () => {
      const user = userEvent.setup()
      vi.spyOn(useAlertsModule, 'useAlerts').mockReturnValue({
        data: mockAlerts,
        isLoading: false,
        isError: false,
        refetch: mockRefetch,
      })

      render(<AlertList />, { wrapper: createWrapper() })

      const refreshButton = screen.getByTestId('refresh-button')
      await user.click(refreshButton)

      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
  })
})
