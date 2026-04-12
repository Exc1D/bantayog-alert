/**
 * AlertList Component
 *
 * Displays official government emergency alerts.
 * Features pull-to-refresh, loading states, and priority filtering.
 */

import { useState } from 'react'
import { RefreshCw, AlertCircle, Info } from 'lucide-react'
import { useAlerts } from '../hooks/useAlerts'
import { AlertCard } from './AlertCard'
import { Button } from '@/shared/components/Button'

export type AlertPriority = 'all' | 'high' | 'medium' | 'low'

export function AlertList() {
  const [selectedPriority, setSelectedPriority] = useState<AlertPriority>('all')

  const { data, isLoading, isError, refetch, isRefetching } = useAlerts()

  // Filter alerts by priority (derived from severity)
  const filteredAlerts = (data ?? []).filter((alert) => {
    if (selectedPriority === 'all') return true
    const priorityMap = {
      high: 'emergency' as const,
      medium: 'warning' as const,
      low: 'info' as const,
    }
    return alert.severity === priorityMap[selectedPriority]
  })

  // Calculate priority counts
  const priorityCounts = {
    all: (data ?? []).length,
    high: (data ?? []).filter((a) => a.severity === 'emergency').length,
    medium: (data ?? []).filter((a) => a.severity === 'warning').length,
    low: (data ?? []).filter((a) => a.severity === 'info').length,
  }

  const handleRefresh = () => {
    refetch()
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20" data-testid="alert-list">
        <div className="max-w-lg mx-auto bg-gray-50 min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">Official Alerts</h1>
            </div>
          </div>

          {/* Skeleton loaders */}
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 p-4 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20" data-testid="alert-list">
        <div className="max-w-lg mx-auto bg-gray-50 min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
            <h1 className="text-xl font-bold text-gray-900">Official Alerts</h1>
          </div>

          {/* Error banner */}
          <div className="p-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center" data-testid="alert-error">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-red-900 mb-2">Unable to load alerts</h2>
              <p className="text-red-700 mb-4">
                Something went wrong while fetching official alerts. Please try again.
              </p>
              <div className="flex justify-center">
                <Button variant="primary" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20" data-testid="alert-list">
        <div className="max-w-lg mx-auto bg-gray-50 min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
            <h1 className="text-xl font-bold text-gray-900">Official Alerts</h1>
          </div>

          {/* Empty state illustration */}
          <div className="p-4">
            <div className="bg-white rounded-lg p-8 text-center" data-testid="alert-empty">
              <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Info className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No active alerts</h2>
              <p className="text-gray-600">
                There are currently no active emergency alerts in your area.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Filtered empty state
  if (filteredAlerts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20" data-testid="alert-list">
        <div className="max-w-lg mx-auto bg-gray-50 min-h-screen">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900">Official Alerts</h1>
              {isRefetching && (
                <RefreshCw
                  className="w-5 h-5 text-primary-blue animate-spin"
                  data-testid="refresh-indicator"
                />
              )}
            </div>
            <PriorityFilters
              selected={selectedPriority}
              counts={priorityCounts}
              onSelect={setSelectedPriority}
            />
          </div>

          {/* Filtered empty state */}
          <div className="p-4">
            <div className="bg-white rounded-lg p-8 text-center" data-testid="alert-empty">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No alerts match this filter
              </h2>
              <p className="text-gray-600">Try selecting a different priority level.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Success state with alerts
  return (
    <div className="min-h-screen bg-gray-50 pb-20" data-testid="alert-list">
      <div className="max-w-lg mx-auto bg-gray-50 min-h-screen">
        {/* Header with pull-to-refresh indicator */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">Official Alerts</h1>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              data-testid="refresh-button"
            >
              <RefreshCw
                className={`w-5 h-5 text-primary-blue ${isRefetching ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
          <PriorityFilters
            selected={selectedPriority}
            counts={priorityCounts}
            onSelect={setSelectedPriority}
          />
        </div>

        {/* Alert cards */}
        <div className="p-4 space-y-3" data-testid="alert-cards">
          {filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Priority Filters Component
// ---------------------------------------------------------------------------

interface PriorityFiltersProps {
  selected: AlertPriority
  counts: Record<AlertPriority, number>
  onSelect: (priority: AlertPriority) => void
}

function PriorityFilters({ selected, counts, onSelect }: PriorityFiltersProps) {
  const filters: { key: AlertPriority; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'bg-gray-100 text-gray-800' },
    { key: 'high', label: 'High', color: 'bg-red-100 text-red-800' },
    { key: 'medium', label: 'Medium', color: 'bg-orange-100 text-orange-800' },
    { key: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-2" data-testid="priority-filters">
      {filters.map((filter) => {
        const isActive = selected === filter.key
        const count = counts[filter.key]

        return (
          <button
            key={filter.key}
            onClick={() => onSelect(filter.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary-blue text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid={`priority-filter-${filter.key}`}
          >
            {filter.label}
            <span className="ml-1 text-xs opacity-75">({count})</span>
          </button>
        )
      })}
    </div>
  )
}

