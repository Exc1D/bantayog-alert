import { useState, useCallback } from 'react'
import type { IncidentSeverity } from '@/shared/types/firestore.types'
import type { DisasterReport } from '../types'
import type { TimeRange } from '../utils/timeFilters'
import { isWithinTimeRange } from '../utils/timeFilters'

export interface UseReportFiltersResult {
  /** Currently selected severity levels */
  selectedSeverities: IncidentSeverity[]
  /** Currently selected time range */
  selectedTimeRange: TimeRange
  /** Number of active filters (severity + time) */
  filterCount: number
  /** Toggle a severity filter on/off */
  toggleSeverity: (severity: IncidentSeverity) => void
  /** Set the time range filter */
  setTimeRange: (timeRange: TimeRange) => void
  /** Clear all filters (severity and time) */
  clearFilters: () => void
  /** Check if a report matches the selected filters */
  matchesFilters: (report: DisasterReport) => boolean
  /** Filter an array of reports based on selected filters */
  filterReports: (reports: DisasterReport[]) => DisasterReport[]
}

/**
 * Custom hook for managing report filter state and logic.
 * Handles both severity and time range filters.
 *
 * When no filters are selected, all reports are shown.
 * When filters are selected, reports must match BOTH severity AND time criteria.
 *
 * @returns Filter state and functions
 */
export function useReportFilters(): UseReportFiltersResult {
  const [selectedSeverities, setSelectedSeverities] = useState<IncidentSeverity[]>([])
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('all')

  const toggleSeverity = useCallback((severity: IncidentSeverity) => {
    setSelectedSeverities((prev) => {
      const isSelected = prev.includes(severity)
      if (isSelected) {
        return prev.filter((s) => s !== severity)
      } else {
        return [...prev, severity]
      }
    })
  }, [])

  const setTimeRange = useCallback((timeRange: TimeRange) => {
    setSelectedTimeRange(timeRange)
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedSeverities([])
    setSelectedTimeRange('all')
  }, [])

  const matchesFilters = useCallback(
    (report: DisasterReport): boolean => {
      // Check severity filter
      const matchesSeverity = selectedSeverities.length === 0 || selectedSeverities.includes(report.severity)

      // Check time range filter
      const matchesTime = isWithinTimeRange(report.timestamp, selectedTimeRange)

      // Report must match BOTH filters
      return matchesSeverity && matchesTime
    },
    [selectedSeverities, selectedTimeRange]
  )

  const filterReports = useCallback(
    (reports: DisasterReport[]): DisasterReport[] => {
      return reports.filter(matchesFilters)
    },
    [matchesFilters]
  )

  // Filter count = number of severity filters + (1 if time filter is active, 0 if 'all')
  const filterCount = selectedSeverities.length + (selectedTimeRange !== 'all' ? 1 : 0)

  return {
    selectedSeverities,
    selectedTimeRange,
    filterCount,
    toggleSeverity,
    setTimeRange,
    clearFilters,
    matchesFilters,
    filterReports,
  }
}
