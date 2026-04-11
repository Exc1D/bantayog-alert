import { renderHook, act } from '@testing-library/react'
import { useReportFilters } from '../useReportFilters'
import type { DisasterReport } from '../../types'

describe('useReportFilters', () => {
  const NOW = Date.now()

  const createMockReport = (
    id: string,
    severity: 'high' | 'medium' | 'low' | 'critical',
    timestamp: number
  ): DisasterReport => ({
    id,
    incidentType: 'flood',
    severity,
    status: 'pending',
    timestamp,
    location: { latitude: 14.5, longitude: 120.9 },
  })

  describe('initial state', () => {
    it('should initialize with no filters selected', () => {
      const { result } = renderHook(() => useReportFilters())

      expect(result.current.selectedSeverities).toEqual([])
      expect(result.current.selectedTimeRange).toBe('all')
      expect(result.current.filterCount).toBe(0)
    })
  })

  describe('severity filtering', () => {
    it('should add severity when toggling unselected severity', () => {
      const { result } = renderHook(() => useReportFilters())

      act(() => {
        result.current.toggleSeverity('high')
      })

      expect(result.current.selectedSeverities).toEqual(['high'])
      expect(result.current.filterCount).toBe(1)
    })

    it('should remove severity when toggling selected severity', () => {
      const { result } = renderHook(() => useReportFilters())

      act(() => {
        result.current.toggleSeverity('high')
        result.current.toggleSeverity('critical')
      })

      expect(result.current.selectedSeverities).toEqual(['high', 'critical'])
      expect(result.current.filterCount).toBe(2)

      act(() => {
        result.current.toggleSeverity('high')
      })

      expect(result.current.selectedSeverities).toEqual(['critical'])
      expect(result.current.filterCount).toBe(1)
    })

    it('should handle multiple severity selections', () => {
      const { result } = renderHook(() => useReportFilters())

      const severities: Array<'high' | 'medium' | 'low' | 'critical'> = ['high', 'medium', 'low', 'critical']

      act(() => {
        severities.forEach((severity) => result.current.toggleSeverity(severity))
      })

      expect(result.current.selectedSeverities).toEqual(severities)
      expect(result.current.filterCount).toBe(4)
    })
  })

  describe('time range filtering', () => {
    it('should set time range', () => {
      const { result } = renderHook(() => useReportFilters())

      act(() => {
        result.current.setTimeRange('1h')
      })

      expect(result.current.selectedTimeRange).toBe('1h')
      expect(result.current.filterCount).toBe(1)
    })

    it('should change time range', () => {
      const { result } = renderHook(() => useReportFilters())

      act(() => {
        result.current.setTimeRange('1h')
      })

      expect(result.current.selectedTimeRange).toBe('1h')

      act(() => {
        result.current.setTimeRange('24h')
      })

      expect(result.current.selectedTimeRange).toBe('24h')
    })

    it('should set to "all" time range', () => {
      const { result } = renderHook(() => useReportFilters())

      act(() => {
        result.current.setTimeRange('1h')
      })

      expect(result.current.filterCount).toBe(1)

      act(() => {
        result.current.setTimeRange('all')
      })

      expect(result.current.selectedTimeRange).toBe('all')
      expect(result.current.filterCount).toBe(0)
    })

    it('should filter reports by time range', () => {
      const { result } = renderHook(() => useReportFilters())

      const reports: DisasterReport[] = [
        createMockReport('1', 'high', NOW), // Current
        createMockReport('2', 'high', NOW - 30 * 60 * 1000), // 30 minutes ago
        createMockReport('3', 'high', NOW - 2 * 60 * 60 * 1000), // 2 hours ago
      ]

      // All reports match with "all" time range
      expect(result.current.filterReports(reports)).toHaveLength(3)

      act(() => {
        result.current.setTimeRange('1h')
      })

      // Only first 2 reports match 1h range
      const filtered = result.current.filterReports(reports)
      expect(filtered).toHaveLength(2)
      expect(filtered.map((r) => r.id)).toEqual(['1', '2'])
    })
  })

  describe('combined filtering', () => {
    it('should filter by both severity and time', () => {
      const { result } = renderHook(() => useReportFilters())

      const reports: DisasterReport[] = [
        createMockReport('1', 'high', NOW), // High, current
        createMockReport('2', 'medium', NOW), // Medium, current
        createMockReport('3', 'high', NOW - 2 * 60 * 60 * 1000), // High, 2h ago
        createMockReport('4', 'medium', NOW - 2 * 60 * 60 * 1000), // Medium, 2h ago
      ]

      // All reports match initially
      expect(result.current.filterReports(reports)).toHaveLength(4)

      act(() => {
        result.current.toggleSeverity('high')
        result.current.setTimeRange('1h')
      })

      // Only high severity + within 1h
      const filtered = result.current.filterReports(reports)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('1')
    })

    it('should count both severity and time filters', () => {
      const { result } = renderHook(() => useReportFilters())

      expect(result.current.filterCount).toBe(0)

      act(() => {
        result.current.toggleSeverity('high')
      })

      expect(result.current.filterCount).toBe(1)

      act(() => {
        result.current.setTimeRange('1h')
      })

      expect(result.current.filterCount).toBe(2)

      act(() => {
        result.current.toggleSeverity('medium')
      })

      expect(result.current.filterCount).toBe(3)
    })

    it('should not count "all" time range as active filter', () => {
      const { result } = renderHook(() => useReportFilters())

      act(() => {
        result.current.toggleSeverity('high')
        result.current.setTimeRange('all')
      })

      expect(result.current.filterCount).toBe(1) // Only severity counted
    })

    it('should match reports that satisfy both filters', () => {
      const { result } = renderHook(() => useReportFilters())

      const reports: DisasterReport[] = [
        createMockReport('1', 'high', NOW),
        createMockReport('2', 'high', NOW - 30 * 60 * 1000),
        createMockReport('3', 'medium', NOW),
        createMockReport('4', 'low', NOW - 2 * 60 * 60 * 1000),
      ]

      act(() => {
        result.current.toggleSeverity('high')
        result.current.toggleSeverity('medium')
        result.current.setTimeRange('1h')
      })

      // High or medium AND within 1h
      const filtered = result.current.filterReports(reports)
      expect(filtered).toHaveLength(3)
      expect(filtered.map((r) => r.id)).toEqual(['1', '2', '3'])
    })
  })

  describe('clear filters', () => {
    it('should clear all filters', () => {
      const { result } = renderHook(() => useReportFilters())

      act(() => {
        result.current.toggleSeverity('high')
        result.current.toggleSeverity('medium')
        result.current.setTimeRange('1h')
      })

      expect(result.current.filterCount).toBe(3)

      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.selectedSeverities).toEqual([])
      expect(result.current.selectedTimeRange).toBe('all')
      expect(result.current.filterCount).toBe(0)
    })

    it('should show all reports after clearing filters', () => {
      const { result } = renderHook(() => useReportFilters())

      const reports: DisasterReport[] = [
        createMockReport('1', 'high', NOW),
        createMockReport('2', 'medium', NOW - 2 * 60 * 60 * 1000),
        createMockReport('3', 'low', NOW - 7 * 24 * 60 * 60 * 1000),
      ]

      act(() => {
        result.current.toggleSeverity('high')
        result.current.setTimeRange('1h')
      })

      expect(result.current.filterReports(reports)).toHaveLength(1)

      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.filterReports(reports)).toHaveLength(3)
    })
  })

  describe('matchesFilters', () => {
    it('should return true for all reports when no filters active', () => {
      const { result } = renderHook(() => useReportFilters())

      const report = createMockReport('1', 'high', NOW - 24 * 60 * 60 * 1000)

      expect(result.current.matchesFilters(report)).toBe(true)
    })

    it('should return true when report matches both filters', () => {
      const { result } = renderHook(() => useReportFilters())

      const report = createMockReport('1', 'high', NOW - 30 * 60 * 1000)

      act(() => {
        result.current.toggleSeverity('high')
        result.current.setTimeRange('1h')
      })

      expect(result.current.matchesFilters(report)).toBe(true)
    })

    it('should return false when report matches severity but not time', () => {
      const { result } = renderHook(() => useReportFilters())

      const report = createMockReport('1', 'high', NOW - 2 * 60 * 60 * 1000)

      act(() => {
        result.current.toggleSeverity('high')
        result.current.setTimeRange('1h')
      })

      expect(result.current.matchesFilters(report)).toBe(false)
    })

    it('should return false when report matches time but not severity', () => {
      const { result } = renderHook(() => useReportFilters())

      const report = createMockReport('1', 'medium', NOW)

      act(() => {
        result.current.toggleSeverity('high')
        result.current.setTimeRange('1h')
      })

      expect(result.current.matchesFilters(report)).toBe(false)
    })

    it('should return false when report matches neither filter', () => {
      const { result } = renderHook(() => useReportFilters())

      const report = createMockReport('1', 'low', NOW - 2 * 60 * 60 * 1000)

      act(() => {
        result.current.toggleSeverity('high')
        result.current.setTimeRange('1h')
      })

      expect(result.current.matchesFilters(report)).toBe(false)
    })
  })

  describe('filterReports', () => {
    it('should return empty array for empty input', () => {
      const { result } = renderHook(() => useReportFilters())

      expect(result.current.filterReports([])).toEqual([])
    })

    it('should filter complex report set correctly', () => {
      const { result } = renderHook(() => useReportFilters())

      const reports: DisasterReport[] = [
        createMockReport('1', 'critical', NOW), // Critical, current
        createMockReport('2', 'high', NOW), // High, current
        createMockReport('3', 'high', NOW - 30 * 60 * 1000), // High, 30min ago
        createMockReport('4', 'medium', NOW - 30 * 60 * 1000), // Medium, 30min ago
        createMockReport('5', 'medium', NOW - 2 * 60 * 60 * 1000), // Medium, 2h ago
        createMockReport('6', 'low', NOW - 2 * 60 * 60 * 1000), // Low, 2h ago
        createMockReport('7', 'low', NOW - 8 * 24 * 60 * 60 * 1000), // Low, 8 days ago
      ]

      // Filter: Critical or High, within 24h
      act(() => {
        result.current.toggleSeverity('critical')
        result.current.toggleSeverity('high')
        result.current.setTimeRange('24h')
      })

      const filtered = result.current.filterReports(reports)
      expect(filtered).toHaveLength(3)
      expect(filtered.map((r) => r.id)).toEqual(['1', '2', '3'])
    })
  })
})
