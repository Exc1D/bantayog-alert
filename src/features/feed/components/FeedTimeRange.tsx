/**
 * FeedTimeRange Component
 *
 * Time range filter for showing reports from specific time periods.
 * Dropdown with options like "Last 24h", "Last 7 days", etc.
 */

import { Clock, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export type TimeRangeOption = '24h' | '7d' | '30d' | 'all'

export interface FeedTimeRangeProps {
  value: TimeRangeOption
  onChange: (option: TimeRangeOption) => void
}

const TIME_RANGE_OPTIONS: {
  value: TimeRangeOption
  label: string
  description: string
}[] = [
  {
    value: '24h',
    label: 'Last 24h',
    description: 'Reports from the last 24 hours',
  },
  {
    value: '7d',
    label: 'Last 7 days',
    description: 'Reports from the last week',
  },
  {
    value: '30d',
    label: 'Last 30 days',
    description: 'Reports from the last month',
  },
  {
    value: 'all',
    label: 'All time',
    description: 'Show all reports',
  },
]

export function FeedTimeRange({ value, onChange }: FeedTimeRangeProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = TIME_RANGE_OPTIONS.find((opt) => opt.value === value)

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

  const handleSelect = (option: TimeRangeOption) => {
    onChange(option)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef} data-testid="feed-time-range">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors min-w-[160px]"
        data-testid="time-range-button"
      >
        <Clock className="w-4 h-4 text-gray-600" />
        <span className="flex-1 text-left">
          <span className="font-medium text-gray-900">{selectedOption?.label}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          data-testid="time-range-dropdown"
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                value === option.value
                  ? 'bg-blue-50 text-primary-blue font-medium'
                  : 'text-gray-700'
              }`}
              data-testid={`time-range-option-${option.value}`}
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
