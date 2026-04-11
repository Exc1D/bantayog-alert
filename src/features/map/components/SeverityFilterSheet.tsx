import { useState, useMemo, useEffect } from 'react'
import { Modal } from '@/shared/components/Modal'
import type { IncidentSeverity } from '@/shared/types/firestore.types'
import type { DisasterReport } from '../types'
import type { TimeRange } from '../utils/timeFilters'
import { TIME_RANGE_LABELS } from '../utils/timeFilters'

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  critical: 'bg-red-600 border-red-700',
  high: 'bg-red-500 border-red-600',
  medium: 'bg-amber-500 border-amber-600',
  low: 'bg-yellow-500 border-yellow-600',
}

export interface SeverityFilterSheetProps {
  /** Whether the filter sheet is open */
  isOpen: boolean
  /** Callback when sheet should close */
  onClose: () => void
  /** Current selected severities */
  selectedSeverities: IncidentSeverity[]
  /** Callback to toggle a severity */
  onToggleSeverity: (severity: IncidentSeverity) => void
  /** Callback to clear all filters */
  onClearFilters: () => void
  /** All disaster reports (for counting) */
  reports: DisasterReport[]
  /** Current selected time range */
  selectedTimeRange: TimeRange
  /** Callback to set time range */
  onSetTimeRange: (timeRange: TimeRange) => void
}

/**
 * Severity filter bottom sheet with checkboxes and report counts.
 * Shows count of reports per severity and allows multi-select filtering.
 * Also includes time range filtering.
 *
 * @param isOpen - Whether the sheet is visible
 * @param onClose - Callback when sheet closes
 * @param selectedSeverities - Currently selected severity levels
 * @param onToggleSeverity - Toggle severity on/off
 * @param onClearFilters - Clear all selected filters
 * @param reports - All disaster reports for counting
 * @param selectedTimeRange - Currently selected time range
 * @param onSetTimeRange - Set time range filter
 */
export function SeverityFilterSheet({
  isOpen,
  onClose,
  selectedSeverities,
  onToggleSeverity,
  onClearFilters,
  reports,
  selectedTimeRange,
  onSetTimeRange,
}: SeverityFilterSheetProps) {
  const [localSelection, setLocalSelection] = useState<IncidentSeverity[]>(selectedSeverities)
  const [localTimeRange, setLocalTimeRange] = useState<TimeRange>(selectedTimeRange)

  // Update local selections when props change
  useEffect(() => {
    setLocalSelection(selectedSeverities)
    setLocalTimeRange(selectedTimeRange)
  }, [selectedSeverities, selectedTimeRange])

  // Count reports per severity
  const severityCounts = useMemo(() => {
    const counts: Record<IncidentSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }

    reports.forEach((report) => {
      counts[report.severity]++
    })

    return counts
  }, [reports])

  const isSeveritySelected = (severity: IncidentSeverity) => {
    return localSelection.includes(severity)
  }

  const handleToggle = (severity: IncidentSeverity) => {
    setLocalSelection((prev) => {
      const isSelected = prev.includes(severity)
      if (isSelected) {
        return prev.filter((s) => s !== severity)
      } else {
        return [...prev, severity]
      }
    })
  }

  const handleApply = () => {
    // Apply all selections from local state
    localSelection.forEach((severity) => {
      if (!selectedSeverities.includes(severity)) {
        onToggleSeverity(severity)
      }
    })
    // Remove deselected severities
    selectedSeverities.forEach((severity) => {
      if (!localSelection.includes(severity)) {
        onToggleSeverity(severity)
      }
    })
    // Apply time range
    onSetTimeRange(localTimeRange)
    onClose()
  }

  const handleClearAll = () => {
    setLocalSelection([])
    setLocalTimeRange('all')
    onClearFilters()
  }

  const totalReports = reports.length
  const hasActiveFilters = localSelection.length > 0 || localTimeRange !== 'all'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Filter Reports">
      <div className="flex flex-col gap-4" data-testid="severity-filter-sheet">
        {/* Report count summary */}
        <div className="text-sm text-gray-600">
          {totalReports} {totalReports === 1 ? 'report' : 'reports'} in your area
        </div>

        {/* Time range filter */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Time Range</label>
          <div
            className="flex bg-gray-100 rounded-lg p-1"
            role="group"
            aria-label="Time range filters"
          >
            {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => {
              const isSelected = localTimeRange === range
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => setLocalTimeRange(range)}
                  className={`
                    flex-1 py-2 px-3 rounded-md text-sm font-medium
                    transition-all duration-150
                    ${
                      isSelected
                        ? 'bg-white text-primary-blue shadow-sm'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                    }
                  `}
                  data-testid={`time-range-button-${range}`}
                  aria-pressed={isSelected}
                >
                  {TIME_RANGE_LABELS[range]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Severity options */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Severity</label>
          <div className="flex flex-col gap-2" role="group" aria-label="Severity filters">
          {(Object.keys(SEVERITY_LABELS) as IncidentSeverity[]).map((severity) => {
            const count = severityCounts[severity]
            const isSelected = isSeveritySelected(severity)
            const colorClass = SEVERITY_COLORS[severity]

            return (
              <label
                key={severity}
                className={`
                  flex items-center justify-between
                  p-4 rounded-lg border-2 cursor-pointer
                  transition-all duration-150
                  ${isSelected ? `${colorClass} text-white` : 'border-gray-200 hover:border-gray-300'}
                `}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-gray-300 text-primary-blue focus:ring-primary-blue"
                    checked={isSelected}
                    onChange={() => handleToggle(severity)}
                    data-testid={`severity-checkbox-${severity}`}
                  />
                  <span className="font-medium">{SEVERITY_LABELS[severity]}</span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    isSelected ? 'text-white' : 'text-gray-600'
                  }`}
                  data-testid={`severity-count-${severity}`}
                >
                  {count}
                </span>
              </label>
            )
          })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleClearAll}
            disabled={!hasActiveFilters}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="clear-filters-button"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-3 rounded-lg bg-primary-blue text-white font-medium hover:bg-blue-700 transition-colors"
            data-testid="apply-filters-button"
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  )
}
