/**
 * useFeedReports Hook Tests
 *
 * Tests the infinite scroll pagination hook for feed reports.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useFeedReports } from '../useFeedReports'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the firestore service
const mockGetCollection = vi.fn()
vi.mock('@/shared/services/firestore.service', () => ({
  getCollection: () => mockGetCollection(),
}))

// Mock report data
const mockReports = [
  {
    id: 'report-1',
    createdAt: Date.now() - 3600000, // 1 hour ago
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
  },
  {
    id: 'report-2',
    createdAt: Date.now() - 7200000, // 2 hours ago
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

describe('useFeedReports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCollection.mockReset()
  })

  describe('when fetching reports', () => {
    it('should return reports on successful fetch', async () => {
      mockGetCollection.mockResolvedValue(mockReports)

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data?.[0].id).toBe('report-1')
      expect(result.current.data?.[0].timeAgo).toBe('1h ago')
      expect(result.current.data?.[0].locationDisplay).toBe('Brgy. 1, Daet')
      expect(result.current.data?.[0].typeDisplay).toBe('Flood')
    })

    it('should set isLoading to true while fetching', () => {
      mockGetCollection.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('should set isError to true on fetch failure', async () => {
      mockGetCollection.mockRejectedValue(new Error('Failed to fetch'))

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  describe('pagination', () => {
    it('should indicate hasNextPage when report count equals page size', async () => {
      // Return exactly 10 reports (PAGE_SIZE)
      const fullPage = Array.from({ length: 10 }, (_, i) => ({
        ...mockReports[0],
        id: `report-${i}`,
      }))
      mockGetCollection.mockResolvedValue(fullPage)

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.hasNextPage).toBe(true)
    })

    it('should not indicate hasNextPage when report count is less than page size', async () => {
      // Return less than 10 reports
      mockGetCollection.mockResolvedValue(mockReports)

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.hasNextPage).toBe(false)
    })

    it('should call fetchNextPage and trigger loading state', async () => {
      const fullPage = Array.from({ length: 10 }, (_, i) => ({
        ...mockReports[0],
        id: `report-${i}`,
      }))
      mockGetCollection.mockResolvedValue(fullPage)

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.hasNextPage).toBe(true)
      })

      // Trigger next page fetch
      result.current.fetchNextPage()

      // Verify fetchNextPage was called and another fetch was triggered
      await waitFor(() => {
        expect(mockGetCollection).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('refetch', () => {
    it('should refetch reports when refetch is called', async () => {
      mockGetCollection.mockResolvedValue(mockReports)

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockGetCollection).toHaveBeenCalledTimes(1)

      await result.current.refetch()

      await waitFor(() => {
        expect(mockGetCollection).toHaveBeenCalledTimes(2)
      })
    })

    it('should trigger refetch when refetch is called', async () => {
      mockGetCollection.mockResolvedValue(mockReports)

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(mockGetCollection).toHaveBeenCalledTimes(1)

      // Trigger refetch
      result.current.refetch()

      // Verify another fetch was triggered
      await waitFor(() => {
        expect(mockGetCollection).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('disabled state', () => {
    it('should not fetch when disabled', () => {
      const { result } = renderHook(() => useFeedReports({ enabled: false }), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(false)
      expect(mockGetCollection).not.toHaveBeenCalled()
    })
  })

  describe('data transformation', () => {
    it('should format time ago correctly', async () => {
      const now = Date.now()
      const recentReport = {
        ...mockReports[0],
        createdAt: now - 30000, // 30 seconds ago
      }
      mockGetCollection.mockResolvedValue([recentReport])

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.[0].timeAgo).toBe('just now')
    })

    it('should format incident type correctly', async () => {
      const medicalReport = {
        ...mockReports[0],
        incidentType: 'medical_emergency' as const,
      }
      mockGetCollection.mockResolvedValue([medicalReport])

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.[0].typeDisplay).toBe('Medical Emergency')
    })

    it('should set isVerified correctly', async () => {
      const pendingReport = {
        ...mockReports[0],
        status: 'pending' as const,
        verifiedAt: undefined,
        verifiedBy: undefined,
      }
      mockGetCollection.mockResolvedValue([pendingReport])

      const { result } = renderHook(() => useFeedReports(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data?.[0].isVerified).toBe(false)
    })
  })
})
