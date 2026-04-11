import { useState, useCallback } from 'react'
import type { IncidentSeverity } from '@/shared/types/firestore.types'
import type { DisasterReport } from '../types'

export interface UseSeverityFilterResult {
  /** Currently selected severity levels */
  selectedSeverities: IncidentSeverity[]
  /** Number of active filters */
  filterCount: number
  /** Toggle a severity filter on/off */
  toggleSeverity: (severity: IncidentSeverity) => void
  /** Clear all severity filters */
  clearFilters: () => void
  /** Check if a report matches the selected filters */
  matchesFilters: (report: DisasterReport) => boolean
  /** Filter an array of reports based on selected severities */
  filterReports: (reports: DisasterReport[]) => DisasterReport[]
}

/**
 * Custom hook for managing severity filter state and logic.
 *
 * When no filters are selected, all reports are shown.
 * When filters are selected, only reports with matching severity are shown.
 *
 * @returns Filter state and functions
 */
export function useSeverityFilter(): UseSeverityFilterResult {
  const [selectedSeverities, setSelectedSeverities] = useState<IncidentSeverity[]>([])

  const toggleSeverity = useCallback((severity: IncidentSeverity) => {
    setSelectedSeverities((prev) => {
      const isSelected = prev.includes(severity)
      if (isSelected) {
        // Remove the severity if already selected
        return prev.filter((s) => s !== severity)
      } else {
        // Add the severity if not selected
        return [...prev, severity]
      }
    })
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedSeverities([])
  }, [])

  const matchesFilters = useCallback(
    (report: DisasterReport): boolean => {
      // If no filters selected, show all reports
      if (selectedSeverities.length === 0) {
        return true
      }
      // Only show reports with selected severity
      return selectedSeverities.includes(report.severity)
    },
    [selectedSeverities]
  )

  const filterReports = useCallback(
    (reports: DisasterReport[]): DisasterReport[] => {
      return reports.filter(matchesFilters)
    },
    [matchesFilters]
  )

  const filterCount = selectedSeverities.length

  return {
    selectedSeverities,
    filterCount,
    toggleSeverity,
    clearFilters,
    matchesFilters,
    filterReports,
  }
}
