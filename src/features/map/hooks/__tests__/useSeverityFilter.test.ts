import { renderHook, act } from '@testing-library/react'
import { useSeverityFilter } from '../useSeverityFilter'
import type { DisasterReport } from '../../types'

describe('useSeverityFilter', () => {
  it('should initialize with no filters selected', () => {
    const { result } = renderHook(() => useSeverityFilter())

    expect(result.current.selectedSeverities).toEqual([])
    expect(result.current.filterCount).toBe(0)
  })

  it('should add severity when toggling unselected severity', () => {
    const { result } = renderHook(() => useSeverityFilter())

    act(() => {
      result.current.toggleSeverity('high')
    })

    expect(result.current.selectedSeverities).toEqual(['high'])
    expect(result.current.filterCount).toBe(1)
  })

  it('should remove severity when toggling selected severity', () => {
    const { result } = renderHook(() => useSeverityFilter())

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

  it('should clear all filters', () => {
    const { result } = renderHook(() => useSeverityFilter())

    act(() => {
      result.current.toggleSeverity('high')
      result.current.toggleSeverity('medium')
      result.current.toggleSeverity('low')
    })

    expect(result.current.filterCount).toBe(3)

    act(() => {
      result.current.clearFilters()
    })

    expect(result.current.selectedSeverities).toEqual([])
    expect(result.current.filterCount).toBe(0)
  })

  it('should match all reports when no filters selected', () => {
    const { result } = renderHook(() => useSeverityFilter())

    const reports: DisasterReport[] = [
      {
        id: '1',
        incidentType: 'flood',
        severity: 'high',
        status: 'pending',
        timestamp: Date.now(),
        location: { latitude: 14.5, longitude: 120.9 },
      },
      {
        id: '2',
        incidentType: 'fire',
        severity: 'low',
        status: 'pending',
        timestamp: Date.now(),
        location: { latitude: 14.6, longitude: 121.0 },
      },
    ]

    expect(result.current.matchesFilters(reports[0])).toBe(true)
    expect(result.current.matchesFilters(reports[1])).toBe(true)
  })

  it('should only match reports with selected severity', () => {
    const { result } = renderHook(() => useSeverityFilter())

    act(() => {
      result.current.toggleSeverity('high')
    })

    const reports: DisasterReport[] = [
      {
        id: '1',
        incidentType: 'flood',
        severity: 'high',
        status: 'pending',
        timestamp: Date.now(),
        location: { latitude: 14.5, longitude: 120.9 },
      },
      {
        id: '2',
        incidentType: 'fire',
        severity: 'low',
        status: 'pending',
        timestamp: Date.now(),
        location: { latitude: 14.6, longitude: 121.0 },
      },
    ]

    expect(result.current.matchesFilters(reports[0])).toBe(true)
    expect(result.current.matchesFilters(reports[1])).toBe(false)
  })

  it('should filter reports array correctly', () => {
    const { result } = renderHook(() => useSeverityFilter())

    const reports: DisasterReport[] = [
      {
        id: '1',
        incidentType: 'flood',
        severity: 'high',
        status: 'pending',
        timestamp: Date.now(),
        location: { latitude: 14.5, longitude: 120.9 },
      },
      {
        id: '2',
        incidentType: 'fire',
        severity: 'low',
        status: 'pending',
        timestamp: Date.now(),
        location: { latitude: 14.6, longitude: 121.0 },
      },
      {
        id: '3',
        incidentType: 'earthquake',
        severity: 'critical',
        status: 'pending',
        timestamp: Date.now(),
        location: { latitude: 14.7, longitude: 121.1 },
      },
    ]

    // No filters - all reports
    expect(result.current.filterReports(reports)).toHaveLength(3)

    act(() => {
      result.current.toggleSeverity('high')
      result.current.toggleSeverity('critical')
    })

    const filtered = result.current.filterReports(reports)
    expect(filtered).toHaveLength(2)
    expect(filtered.map((r) => r.id)).toEqual(['1', '3'])
  })

  it('should handle multiple severity selections', () => {
    const { result } = renderHook(() => useSeverityFilter())

    const severities: Array<'high' | 'medium' | 'low' | 'critical'> = ['high', 'medium', 'low', 'critical']

    act(() => {
      severities.forEach((severity) => result.current.toggleSeverity(severity))
    })

    expect(result.current.selectedSeverities).toEqual(severities)
    expect(result.current.filterCount).toBe(4)
  })
})
