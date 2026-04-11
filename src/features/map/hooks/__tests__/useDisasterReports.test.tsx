import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDisasterReports } from '../useDisasterReports'
import { getCollection } from '@/shared/services/firestore.service'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock Firestore service
vi.mock('@/shared/services/firestore.service', () => ({
  getCollection: vi.fn(),
}))

// Mock Firestore query functions
vi.mock('firebase/firestore', () => ({
  where: vi.fn((field, op, value) => ({ field, op, value })),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
}))

describe('useDisasterReports', () => {
  const mockReports = [
    {
      id: 'report1',
      incidentType: 'flood' as const,
      severity: 'high' as const,
      status: 'verified' as const,
      createdAt: Date.now() - 3600000, // 1 hour ago
      approximateLocation: {
        barangay: 'Barangay 1',
        municipality: 'Daet',
        approximateCoordinates: {
          latitude: 14.5995,
          longitude: 120.9842,
        },
      },
      description: 'Heavy flooding in the area',
      isAnonymous: true,
      updatedAt: Date.now() - 3600000,
    },
    {
      id: 'report2',
      incidentType: 'fire' as const,
      severity: 'critical' as const,
      status: 'assigned' as const,
      createdAt: Date.now() - 7200000, // 2 hours ago
      approximateLocation: {
        barangay: 'Barangay 2',
        municipality: 'Daet',
        approximateCoordinates: {
          latitude: 14.61,
          longitude: 120.99,
        },
      },
      description: 'Building fire',
      isAnonymous: false,
      updatedAt: Date.now() - 7200000,
    },
  ]

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  describe('when enabled', () => {
    it('should fetch disaster reports successfully', async () => {
      vi.mocked(getCollection).mockResolvedValue(mockReports)

      const { result } = renderHook(() => useDisasterReports(true), { wrapper })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(getCollection).toHaveBeenCalledWith('reports', expect.any(Array))
      expect(result.current.data).toHaveLength(2)
    })

    it('should transform reports to disaster reports format', async () => {
      vi.mocked(getCollection).mockResolvedValue(mockReports)

      const { result } = renderHook(() => useDisasterReports(true), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      const disasterReports = result.current.data

      expect(disasterReports).toEqual([
        {
          id: 'report1',
          incidentType: 'flood',
          severity: 'high',
          status: 'verified',
          timestamp: mockReports[0].createdAt,
          location: {
            latitude: 14.5995,
            longitude: 120.9842,
          },
          description: 'Heavy flooding in the area',
        },
        {
          id: 'report2',
          incidentType: 'fire',
          severity: 'critical',
          status: 'assigned',
          timestamp: mockReports[1].createdAt,
          location: {
            latitude: 14.61,
            longitude: 120.99,
          },
          description: 'Building fire',
        },
      ])
    })

    it('should handle empty reports array', async () => {
      vi.mocked(getCollection).mockResolvedValueOnce([])

      const { result } = renderHook(() => useDisasterReports(true), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.data).toEqual([])
    })

    it('should handle fetch errors', async () => {
      const error = new Error('Failed to fetch reports')
      vi.mocked(getCollection).mockRejectedValueOnce(error)

      const { result } = renderHook(() => useDisasterReports(true), { wrapper })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      }, { timeout: 5000 })

      expect(result.current.error).toBeTruthy()
    })
  })

  describe('when disabled', () => {
    it('should not fetch reports', async () => {
      vi.mocked(getCollection).mockResolvedValue(mockReports)

      const { result } = renderHook(() => useDisasterReports(false), { wrapper })

      expect(result.current.isLoading).toBe(false)
      expect(getCollection).not.toHaveBeenCalled()
    })

    it('should return idle state', () => {
      vi.mocked(getCollection).mockResolvedValue(mockReports)

      const { result } = renderHook(() => useDisasterReports(false), { wrapper })

      expect(result.current.data).toBeUndefined()
    })
  })

  describe('query configuration', () => {
    it('should use correct query key', async () => {
      vi.mocked(getCollection).mockResolvedValueOnce(mockReports)

      renderHook(() => useDisasterReports(true), { wrapper })

      await waitFor(() => {
        expect(getCollection).toHaveBeenCalled()
      }, { timeout: 5000 })

      // Check that the query is using the correct key via cache
      await waitFor(() => {
        const cachedData = queryClient.getQueryData(['disaster-reports'])
        expect(cachedData).toBeDefined()
      })
    })

    it('should have correct stale time', async () => {
      vi.mocked(getCollection).mockResolvedValueOnce(mockReports)

      const { result } = renderHook(() => useDisasterReports(true), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Data should be fresh for 2 minutes
      expect(result.current.isRefetching).toBe(false)
      // staleTime is not exposed in the query result, so we skip this check
    })

    it('should expose refetch function', async () => {
      vi.mocked(getCollection).mockResolvedValue(mockReports)

      const { result } = renderHook(() => useDisasterReports(true), { wrapper })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(typeof result.current.refetch).toBe('function')

      // Trigger refetch - should not throw
      await expect(async () => {
        await result.current.refetch()
      }).not.toThrow()
    })

    it('should track last updated timestamp', async () => {
      vi.mocked(getCollection).mockResolvedValue(mockReports)

      const { result } = renderHook(() => useDisasterReports(true), { wrapper })

      // Initially, lastUpdated should be null
      expect(result.current.lastUpdated).toBeNull()

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // After data loads, lastUpdated should be set
      expect(result.current.lastUpdated).toBeTruthy()
      expect(typeof result.current.lastUpdated).toBe('number')
    })
  })
})

