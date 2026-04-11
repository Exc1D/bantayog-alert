import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useLocationSearch } from '../useLocationSearch'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
})

// Mock fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve([
        {
          place_id: 1,
          licence: 'test',
          osm_type: 'node',
          osm_id: 123,
          lat: '14.5995',
          lon: '120.9842',
          display_name: 'Test Location, Philippines',
          address: {},
          boundingbox: ['0', '0', '0', '0'],
        },
      ]),
  }),
) as ReturnType<typeof vi.fn>

describe('useLocationSearch', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useLocationSearch())

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.recentSearches).toEqual([])
  })

  it('should load recent searches from localStorage on mount', () => {
    const recentSearches = [
      {
        displayName: 'Manila, Philippines',
        lat: 14.5995,
        lng: 120.9842,
        timestamp: Date.now(),
      },
    ]

    localStorage.setItem('bantayog-recent-searches', JSON.stringify(recentSearches))

    const { result } = renderHook(() => useLocationSearch())

    expect(result.current.recentSearches).toEqual(recentSearches)
  })

  it('should filter out old recent searches (older than 30 days)', () => {
    const recentSearches = [
      {
        displayName: 'Old Search',
        lat: 14.5995,
        lng: 120.9842,
        timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000, // 31 days ago
      },
      {
        displayName: 'Recent Search',
        lat: 14.5995,
        lng: 120.9842,
        timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
      },
    ]

    localStorage.setItem('bantayog-recent-searches', JSON.stringify(recentSearches))

    const { result } = renderHook(() => useLocationSearch())

    expect(result.current.recentSearches).toHaveLength(1)
    expect(result.current.recentSearches[0].displayName).toBe('Recent Search')
  })

  it('should update query and trigger search', async () => {
    const { result } = renderHook(() => useLocationSearch())

    act(() => {
      result.current.setQuery('Manila')
    })

    expect(result.current.query).toBe('Manila')

    // Wait for debounced search to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.results).toHaveLength(1)
    })
  })

  it('should debounce search input', async () => {
    const { result } = renderHook(() => useLocationSearch())

    act(() => {
      result.current.setQuery('M')
    })

    act(() => {
      result.current.setQuery('Ma')
    })

    act(() => {
      result.current.setQuery('Man')
    })

    // Should only call fetch once after debounce
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledTimes(1)
      },
      { timeout: 1000 },
    )
  })

  it('should clear search', () => {
    const { result } = renderHook(() => useLocationSearch())

    act(() => {
      result.current.setQuery('Test')
    })

    expect(result.current.query).toBe('Test')

    act(() => {
      result.current.clearSearch()
    })

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
  })

  it('should add to recent searches', () => {
    const { result } = renderHook(() => useLocationSearch())

    const mockResult = {
      place_id: 1,
      licence: 'test',
      osm_type: 'node',
      osm_id: 123,
      lat: '14.5995',
      lon: '120.9842',
      display_name: 'Test Location',
      address: {},
      boundingbox: ['0', '0', '0', '0'],
    }

    act(() => {
      result.current.addToRecentSearches(mockResult)
    })

    expect(result.current.recentSearches).toHaveLength(1)
    expect(result.current.recentSearches[0].displayName).toBe('Test Location')
    expect(result.current.recentSearches[0].lat).toBe(14.5995)
    expect(result.current.recentSearches[0].lng).toBe(120.9842)
  })

  it('should limit recent searches to 5', () => {
    const { result } = renderHook(() => useLocationSearch())

    // Add 7 searches
    for (let i = 0; i < 7; i++) {
      act(() => {
        result.current.addToRecentSearches({
          place_id: i,
          licence: 'test',
          osm_type: 'node',
          osm_id: i,
          lat: '14.5995',
          lon: '120.9842',
          display_name: `Location ${i}`,
          address: {},
          boundingbox: ['0', '0', '0', '0'],
        })
      })
    }

    expect(result.current.recentSearches).toHaveLength(5)
    // Most recent should be first (Location 6)
    expect(result.current.recentSearches[0].displayName).toBe('Location 6')
  })

  it('should remove duplicate recent searches', () => {
    const { result } = renderHook(() => useLocationSearch())

    const mockResult = {
      place_id: 1,
      licence: 'test',
      osm_type: 'node',
      osm_id: 123,
      lat: '14.5995',
      lon: '120.9842',
      display_name: 'Test Location',
      address: {},
      boundingbox: ['0', '0', '0', '0'],
    }

    act(() => {
      result.current.addToRecentSearches(mockResult)
    })

    act(() => {
      result.current.addToRecentSearches(mockResult)
    })

    expect(result.current.recentSearches).toHaveLength(1)
  })

  it('should save recent searches to localStorage', () => {
    const { result } = renderHook(() => useLocationSearch())

    const mockResult = {
      place_id: 1,
      licence: 'test',
      osm_type: 'node',
      osm_id: 123,
      lat: '14.5995',
      lon: '120.9842',
      display_name: 'Test Location',
      address: {},
      boundingbox: ['0', '0', '0', '0'],
    }

    act(() => {
      result.current.addToRecentSearches(mockResult)
    })

    const stored = localStorage.getItem('bantayog-recent-searches')
    expect(stored).toBeDefined()

    const parsed = JSON.parse(stored!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].displayName).toBe('Test Location')
  })

  it('should handle search errors', async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }),
    )

    global.fetch = mockFetch as ReturnType<typeof vi.fn>

    const { result } = renderHook(() => useLocationSearch())

    act(() => {
      result.current.setQuery('Test')
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
      expect(result.current.results).toEqual([])
    })
  })

  it('should select recent search', () => {
    const { result } = renderHook(() => useLocationSearch())

    const recentSearch = {
      displayName: 'Recent Location',
      lat: 14.5995,
      lng: 120.9842,
      timestamp: Date.now(),
    }

    act(() => {
      result.current.selectRecentSearch(recentSearch)
    })

    expect(result.current.query).toBe('Recent Location')
  })

  it('should not search for empty queries', async () => {
    const { result } = renderHook(() => useLocationSearch())

    act(() => {
      result.current.setQuery('   ')
    })

    await waitFor(
      () => {
        expect(global.fetch).not.toHaveBeenCalled()
      },
      { timeout: 1000 },
    )

    expect(result.current.results).toEqual([])
  })

  it('should handle localStorage errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Make localStorage.setItem throw an error
    const originalSetItem = localStorage.setItem
    localStorage.setItem = vi.fn(() => {
      throw new Error('localStorage is full')
    })

    const { result } = renderHook(() => useLocationSearch())

    const mockResult = {
      place_id: 1,
      licence: 'test',
      osm_type: 'node',
      osm_id: 123,
      lat: '14.5995',
      lon: '120.9842',
      display_name: 'Test Location',
      address: {},
      boundingbox: ['0', '0', '0', '0'],
    }

    act(() => {
      result.current.addToRecentSearches(mockResult)
    })

    // Should still add to state even if localStorage fails
    expect(result.current.recentSearches).toHaveLength(1)
    expect(consoleSpy).toHaveBeenCalled()

    localStorage.setItem = originalSetItem
    consoleSpy.mockRestore()
  })
})
