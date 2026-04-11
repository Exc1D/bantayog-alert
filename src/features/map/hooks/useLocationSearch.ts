import { useState, useCallback, useRef, useEffect } from 'react'

const RECENT_SEARCHES_KEY = 'bantayog-recent-searches'
const MAX_RECENT_SEARCHES = 5
const DEBOUNCE_DELAY = 500
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search'

/**
 * Location search result from Nominatim API
 */
export interface LocationSearchResult {
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  lat: string
  lon: string
  display_name: string
  address: {
    [key: string]: string
  }
  boundingbox: [string, string, string, string]
}

/**
 * Recent search item stored in localStorage
 */
interface RecentSearch {
  displayName: string
  lat: number
  lng: number
  timestamp: number
}

export interface UseLocationSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: LocationSearchResult[]
  isLoading: boolean
  error: string | null
  recentSearches: RecentSearch[]
  clearSearch: () => void
  addToRecentSearches: (result: LocationSearchResult) => void
  selectRecentSearch: (search: RecentSearch) => void
}

/**
 * Custom hook for location search with autocomplete.
 * Uses Nominatim API (OpenStreetMap) for geocoding.
 * Implements debounced search and stores recent searches in localStorage.
 *
 * @returns Search state and handlers
 */
export function useLocationSearch(): UseLocationSearchReturn {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[]
        // Validate and filter old searches (older than 30 days)
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
        const valid = parsed.filter((s) => s.timestamp > thirtyDaysAgo)
        setRecentSearches(valid)
      }
    } catch (err) {
      console.warn('Failed to load recent searches from localStorage:', err)
      // Non-fatal error, continue with empty recent searches
    }
  }, [])

  // Debounced search function
  const searchLocations = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const url = `${NOMINATIM_API}?format=json&q=${encodeURIComponent(searchQuery)}`
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Bantayog-Alert-App', // Required by Nominatim usage policy
        },
      })

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`)
      }

      const data = (await response.json()) as LocationSearchResult[]

      // Limit results to 10 for performance
      setResults(data.slice(0, 10))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search locations'
      setError(errorMessage)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced query handler
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      searchLocations(query)
    }, DEBOUNCE_DELAY)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, searchLocations])

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
  }, [])

  // Add to recent searches
  const addToRecentSearches = useCallback((result: LocationSearchResult) => {
    const newSearch: RecentSearch = {
      displayName: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      timestamp: Date.now(),
    }

    setRecentSearches((prev) => {
      // Remove duplicate searches (by display name)
      const filtered = prev.filter((s) => s.displayName !== newSearch.displayName)
      // Add new search at the beginning
      const updated = [newSearch, ...filtered]
      // Keep only the most recent MAX_RECENT_SEARCHES
      const limited = updated.slice(0, MAX_RECENT_SEARCHES)

      // Save to localStorage
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(limited))
      } catch (err) {
        console.warn('Failed to save recent searches to localStorage:', err)
        // Non-fatal error, continue without saving
      }

      return limited
    })
  }, [])

  // Select a recent search
  const selectRecentSearch = useCallback((search: RecentSearch) => {
    // Convert recent search back to a LocationSearchResult-like format
    // This allows the component to handle it the same way as API results
    setQuery(search.displayName)
    setResults([])
  }, [])

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    recentSearches,
    clearSearch,
    addToRecentSearches,
    selectRecentSearch,
  }
}
