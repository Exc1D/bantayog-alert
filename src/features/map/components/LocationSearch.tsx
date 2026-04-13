import { useState } from 'react'
import L from 'leaflet'
import { Search, X, Clock, Loader2 } from 'lucide-react'
import {
  useLocationSearch,
  type LocationSearchResult,
  type RecentSearch,
} from '../hooks/useLocationSearch'

export interface LocationSearchProps {
  map: L.Map
  onLocationSelect?: (lat: number, lng: number) => void
}

/**
 * LocationSearch component that provides a floating search bar with autocomplete.
 * Allows users to search for locations and center the map on selected results.
 *
 * @param map - Leaflet map instance
 * @param onLocationSelect - Optional callback when a location is selected
 */
export function LocationSearch({ map, onLocationSelect }: LocationSearchProps) {
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    recentSearches,
    clearSearch,
    addToRecentSearches,
  } = useLocationSearch()

  const [showDropdown, setShowDropdown] = useState(false)

  // Handle location selection
  const handleSelectLocation = (result: LocationSearchResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)

    // Center map on selected location with animation
    map.flyTo([lat, lng], 15, {
      animate: true,
      duration: 1.5,
    })

    // Add to recent searches
    addToRecentSearches(result)

    // Clear search and hide dropdown
    setQuery(result.display_name)
    setShowDropdown(false)

    // Call optional callback
    if (onLocationSelect) {
      onLocationSelect(lat, lng)
    }
  }

  // Handle recent search selection
  const handleSelectRecent = (search: RecentSearch) => {
    // Center map on recent search location
    map.flyTo([search.lat, search.lng], 15, {
      animate: true,
      duration: 1.5,
    })

    setQuery(search.displayName)
    setShowDropdown(false)

    // Call optional callback
    if (onLocationSelect) {
      onLocationSelect(search.lat, search.lng)
    }
  }

  // Handle input focus
  const handleFocus = () => {
    setShowDropdown(true)
  }

  // Handle input blur (delayed to allow clicking on results)
  const handleBlur = () => {
    // Delay hiding dropdown to allow click events to register
    setTimeout(() => {
      setShowDropdown(false)
    }, 200)
  }

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setShowDropdown(true)
  }

  // Clear search query
  const handleClear = () => {
    clearSearch()
    setShowDropdown(false)
  }

  // Truncate display name for better UI
  const truncateName = (name: string, maxLength: number = 60) => {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength) + '...'
  }

  const hasResults = results.length > 0 || recentSearches.length > 0 || error

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4">
      <div className="relative">
        {/* Search input container */}
        <div className="relative flex items-center bg-white rounded-lg shadow-lg">
          <div className="absolute left-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>

          <input
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Search for a location..."
            className="w-full pl-10 pr-10 py-3 text-sm text-gray-900 placeholder-gray-500 bg-transparent border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue"
            data-testid="location-search-input"
          />

          {/* Clear button */}
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 flex items-center justify-center p-1 text-gray-400 hover:text-gray-600 transition-colors"
              type="button"
              data-testid="location-search-clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute right-10 flex items-center pointer-events-none">
              <Loader2 className="h-4 w-4 text-primary-blue animate-spin" />
            </div>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {showDropdown && hasResults && (
          <div
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl max-h-96 overflow-y-auto"
            data-testid="location-search-dropdown"
          >
            {/* Error message */}
            {error && (
              <div className="p-4 text-sm text-red-600 border-b border-gray-100">
                {error}
              </div>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && query.length === 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-2" />
                    Recent Searches
                  </div>
                </div>
                {recentSearches.map((search, index) => (
                  <button
                    key={`recent-${index}`}
                    type="button"
                    onClick={() => handleSelectRecent(search)}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    data-testid={`recent-search-${index}`}
                  >
                    <div className="flex items-start">
                      <Clock className="h-4 w-4 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="flex-1">{truncateName(search.displayName)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Search results */}
            {results.length > 0 && (
              <div>
                {query.length > 0 && recentSearches.length > 0 && (
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                    Search Results
                  </div>
                )}
                {results.map((result) => (
                  <button
                    key={result.place_id}
                    type="button"
                    onClick={() => handleSelectLocation(result)}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    data-testid={`search-result-${result.place_id}`}
                  >
                    <div className="flex items-start">
                      <Search className="h-4 w-4 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="flex-1">{truncateName(result.display_name)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {!isLoading && query.length > 0 && results.length === 0 && !error && (
              <div className="p-4 text-sm text-gray-500 text-center">
                No locations found. Try a different search term.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
