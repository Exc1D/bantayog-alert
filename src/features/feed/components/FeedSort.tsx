/**
 * FeedSort Component
 *
 * Sort dropdown for ordering reports by various criteria.
 */

import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export type SortOption = 'recent' | 'severity' | 'status'

export interface FeedSortProps {
  value: SortOption
  onChange: (option: SortOption) => void
  reportCount?: number
}

const SORT_OPTIONS: { value: SortOption; label: string; description: string }[] = [
  { value: 'recent', label: 'Recent first', description: 'Newest reports first' },
  { value: 'severity', label: 'Severity', description: 'Critical to low severity' },
  { value: 'status', label: 'Status', description: 'Group by verification status' },
]

export function FeedSort({ value, onChange, reportCount }: FeedSortProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = SORT_OPTIONS.find((opt) => opt.value === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (option: SortOption) => {
    onChange(option)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef} data-testid="feed-sort">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors min-w-[200px]"
        data-testid="sort-button"
      >
        <ArrowUpDown className="w-4 h-4 text-gray-600" />
        <span className="flex-1 text-left">
          <span className="font-medium text-gray-900">{selectedOption?.label}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          data-testid="sort-dropdown"
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                value === option.value ? 'bg-blue-50 text-primary-blue font-medium' : 'text-gray-700'
              }`}
              data-testid={`sort-option-${option.value}`}
            >
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-gray-500">{option.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
