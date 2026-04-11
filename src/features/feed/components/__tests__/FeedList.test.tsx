/**
 * FeedList Component Tests
 *
 * Tests the Facebook-style feed list component with all states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedList } from '../FeedList'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as useFeedReportsModule from '../../hooks/useFeedReports'

// Mock the hook module
vi.mock('../../hooks/useFeedReports')

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof IntersectionObserver

const mockReports = [
  {
    id: 'report-1',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now(),
    approximateLocation: {
      barangay: 'Brgy. 1',
      municipality: 'Daet',
      approximateCoordinates: { latitude: 14.5995, longitude: 120.9842 },
    },
    incidentType: 'flood',
    severity: 'high',
    status: 'verified',
    description: 'Heavy flooding in the area',
    isAnonymous: true,
    verifiedAt: Date.now() - 1800000,
    verifiedBy: 'admin-123',
    timeAgo: '1h ago',
    locationDisplay: 'Brgy. 1, Daet',
    typeDisplay: 'Flood',
    isVerified: true,
  },
  {
    id: 'report-2',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now(),
    approximateLocation: {
      barangay: 'Brgy. 2',
      municipality: 'Daet',
      approximateCoordinates: { latitude: 14.5995, longitude: 120.9842 },
    },
    incidentType: 'fire',
    severity: 'critical',
    status: 'pending',
    description: 'Building on fire',
    isAnonymous: false,
    timeAgo: '2h ago',
    locationDisplay: 'Brgy. 2, Daet',
    typeDisplay: 'Fire',
    isVerified: false,
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('FeedList', () => {
  const mockRefetch = vi.fn()
  const mockFetchNextPage = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockRefetch.mockResolvedValue({})
    mockFetchNextPage.mockResolvedValue({})
  })

  describe('when loading', () => {
    it('should show loading skeleton', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: undefined,
        isLoading: true,
        isRefetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('feed-list')).toBeInTheDocument()
      expect(screen.getByText('Bantayog Feed')).toBeInTheDocument()
      expect(screen.getAllByTestId('feed-card-skeleton')).toHaveLength(3)
    })
  })

  describe('when error occurs', () => {
    it('should show error message with retry button', () => {
      const mockError = new Error('Failed to fetch')
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: undefined,
        isLoading: false,
        isRefetching: false,
        isError: true,
        error: mockError,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('feed-error')).toBeInTheDocument()
      expect(screen.getByText('Unable to load reports')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should call refetch when retry button is clicked', async () => {
      const user = userEvent.setup()
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: undefined,
        isLoading: false,
        isRefetching: false,
        isError: true,
        error: new Error('Failed to fetch'),
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('when empty', () => {
    it('should show empty state illustration', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: [],
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('feed-empty')).toBeInTheDocument()
      expect(screen.getByText('No reports yet')).toBeInTheDocument()
      expect(
        screen.getByText('Be the first to report an incident in your area!')
      ).toBeInTheDocument()
    })
  })

  describe('when reports are loaded', () => {
    it('should display report cards', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: mockReports,
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('feed-reports')).toBeInTheDocument()
      expect(screen.getByTestId('feed-report-report-1')).toBeInTheDocument()
      expect(screen.getByTestId('feed-report-report-2')).toBeInTheDocument()
    })

    it('should display report information correctly', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: mockReports,
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      // First report
      expect(screen.getByText('Flood')).toBeInTheDocument()
      expect(screen.getByText('1h ago')).toBeInTheDocument()
      expect(screen.getByText('Heavy flooding in the area')).toBeInTheDocument()
      expect(screen.getByText('Brgy. 1, Daet')).toBeInTheDocument()
      expect(screen.getByText('HIGH')).toBeInTheDocument()
      expect(screen.getByTestId('verified-badge')).toBeInTheDocument()

      // Second report
      expect(screen.getByText('Fire')).toBeInTheDocument()
      expect(screen.getByText('2h ago')).toBeInTheDocument()
      expect(screen.getByText('Building on fire')).toBeInTheDocument()
      expect(screen.getByText('Brgy. 2, Daet')).toBeInTheDocument()
      expect(screen.getByText('CRITICAL')).toBeInTheDocument()
    })

    it('should show verified badge only for verified reports', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: mockReports,
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      const verifiedBadges = screen.getAllByTestId('verified-badge')
      expect(verifiedBadges).toHaveLength(1)
    })

    it('should show refresh indicator when refetching', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: mockReports,
        isLoading: false,
        isRefetching: true,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('refresh-indicator')).toBeInTheDocument()
    })

    it('should show story cards placeholder', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: mockReports,
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('story-cards-placeholder')).toBeInTheDocument()
    })
  })

  describe('when loading more', () => {
    it('should show loading skeletons when fetching next page', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: mockReports,
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: true,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: true,
      })

      render(<FeedList />, { wrapper: createWrapper() })

      expect(screen.getByTestId('loading-more')).toBeInTheDocument()
      expect(screen.getAllByTestId('feed-card-skeleton')).toHaveLength(2)
    })
  })

  describe('when disabled', () => {
    it('should pass enabled prop to hook', () => {
      vi.spyOn(useFeedReportsModule, 'useFeedReports').mockReturnValue({
        data: undefined,
        isLoading: false,
        isRefetching: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        hasNextPage: false,
        fetchNextPage: mockFetchNextPage,
        isFetchingNextPage: false,
      })

      render(<FeedList enabled={false} />, { wrapper: createWrapper() })

      expect(useFeedReportsModule.useFeedReports).toHaveBeenCalledWith({ enabled: false })
    })
  })
})
