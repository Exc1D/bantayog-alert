/**
 * FeedSearch Component
 *
 * Search bar for filtering reports by location (municipality/barangay).
 * Real-time filtering as user types.
 */

import { Search, X } from 'lucide-react'
import { useState } from 'react'

export interface FeedSearchProps {
  onSearch: (query: string) => void
  placeholder?: string
  resultCount?: number
}

export function FeedSearch({ onSearch, placeholder = 'Search barangay or municipality...', resultCount }: FeedSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const handleClear = () => {
    setSearchQuery('')
    onSearch('')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    onSearch(value)
  }

  const hasValue = searchQuery.length > 0

  return (
    <div className="relative" data-testid="feed-search">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue focus:border-transparent"
          data-testid="search-input"
        />
        {hasValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
            data-testid="clear-search"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Result count */}
      {hasValue && resultCount !== undefined && (
        <p className="text-xs text-gray-600 mt-1" data-testid="search-results-count">
          {resultCount} {resultCount === 1 ? 'report' : 'reports'} found
        </p>
      )}
    </div>
  )
}
