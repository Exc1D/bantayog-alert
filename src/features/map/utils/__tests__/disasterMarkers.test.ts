import { describe, it, expect } from 'vitest'
import {
  createDisasterMarkerIcon,
  formatRelativeTime,
  createPopupContent,
  DISASTER_MARKER_CSS,
} from '../disasterMarkers'
import { IncidentSeverity } from '@/shared/types/firestore.types'

describe('disasterMarkers', () => {
  describe('createDisasterMarkerIcon', () => {
    it('should create icon for high severity', () => {
      const icon = createDisasterMarkerIcon('high')

      expect(icon.options.className).toContain('disaster-marker')
      expect(icon.options.className).toContain('disaster-marker-high')
      expect(icon.options.html).toContain('#dc2626') // Red color
    })

    it('should create icon for medium severity', () => {
      const icon = createDisasterMarkerIcon('medium')

      expect(icon.options.className).toContain('disaster-marker-medium')
      expect(icon.options.html).toContain('#f59e0b') // Orange color
    })

    it('should create icon for low severity', () => {
      const icon = createDisasterMarkerIcon('low')

      expect(icon.options.className).toContain('disaster-marker-low')
      expect(icon.options.html).toContain('#eab308') // Yellow color
    })

    it('should create icon for critical severity', () => {
      const icon = createDisasterMarkerIcon('critical')

      expect(icon.options.className).toContain('disaster-marker-critical')
      expect(icon.options.html).toContain('#7f1d1d') // Dark red color
    })

    it('should have correct icon size and anchor', () => {
      const icon = createDisasterMarkerIcon('high')

      expect(icon.options.iconSize).toEqual([24, 24])
      expect(icon.options.iconAnchor).toEqual([12, 12])
      expect(icon.options.popupAnchor).toEqual([0, -12])
    })

    it('should include circle with white border in HTML', () => {
      const icon = createDisasterMarkerIcon('high')

      expect(icon.options.html).toContain('disaster-marker-circle')
      // The border is styled via CSS, not inline in the HTML
      expect(icon.options.html).toContain('disaster-marker-container')
    })
  })

  describe('DISASTER_MARKER_CSS', () => {
    it('should contain CSS for disaster markers', () => {
      expect(DISASTER_MARKER_CSS).toContain('.disaster-marker')
      expect(DISASTER_MARKER_CSS).toContain('.disaster-marker-circle')
    })

    it('should contain popup styling', () => {
      expect(DISASTER_MARKER_CSS).toContain('.disaster-popup')
      expect(DISASTER_MARKER_CSS).toContain('.disaster-popup-severity')
    })

    it('should contain severity-specific classes', () => {
      expect(DISASTER_MARKER_CSS).toContain('disaster-popup-severity-high')
      expect(DISASTER_MARKER_CSS).toContain('disaster-popup-severity-medium')
      expect(DISASTER_MARKER_CSS).toContain('disaster-popup-severity-low')
      expect(DISASTER_MARKER_CSS).toContain('disaster-popup-severity-critical')
    })

    it('should contain hover effect', () => {
      expect(DISASTER_MARKER_CSS).toContain('.disaster-marker:hover')
      expect(DISASTER_MARKER_CSS).toContain('transform: scale(1.2)')
    })
  })

  describe('formatRelativeTime', () => {
    it('should return "just now" for less than a minute', () => {
      const now = Date.now()
      const timestamp = now - 30 * 1000 // 30 seconds ago

      expect(formatRelativeTime(timestamp)).toBe('just now')
    })

    it('should return minutes ago for less than an hour', () => {
      const now = Date.now()
      const timestamp = now - 15 * 60 * 1000 // 15 minutes ago

      expect(formatRelativeTime(timestamp)).toBe('15 minutes ago')
    })

    it('should return singular "minute" for 1 minute', () => {
      const now = Date.now()
      const timestamp = now - 1 * 60 * 1000 // 1 minute ago

      expect(formatRelativeTime(timestamp)).toBe('1 minute ago')
    })

    it('should return hours ago for less than a day', () => {
      const now = Date.now()
      const timestamp = now - 3 * 60 * 60 * 1000 // 3 hours ago

      expect(formatRelativeTime(timestamp)).toBe('3 hours ago')
    })

    it('should return singular "hour" for 1 hour', () => {
      const now = Date.now()
      const timestamp = now - 1 * 60 * 60 * 1000 // 1 hour ago

      expect(formatRelativeTime(timestamp)).toBe('1 hour ago')
    })

    it('should return days ago for more than a day', () => {
      const now = Date.now()
      const timestamp = now - 2 * 24 * 60 * 60 * 1000 // 2 days ago

      expect(formatRelativeTime(timestamp)).toBe('2 days ago')
    })

    it('should return singular "day" for 1 day', () => {
      const now = Date.now()
      const timestamp = now - 1 * 24 * 60 * 60 * 1000 // 1 day ago

      expect(formatRelativeTime(timestamp)).toBe('1 day ago')
    })
  })

  describe('createPopupContent', () => {
    it('should create popup with incident type and severity', () => {
      const content = createPopupContent({
        incidentType: 'flood',
        severity: 'high',
        timeAgo: '2 hours ago',
      })

      expect(content).toContain('Flood')
      expect(content).toContain('high')
      expect(content).toContain('2 hours ago')
      expect(content).toContain('disaster-popup')
    })

    it('should format incident type with spaces', () => {
      const content = createPopupContent({
        incidentType: 'medical_emergency',
        severity: 'medium',
        timeAgo: '1 hour ago',
      })

      expect(content).toContain('Medical Emergency')
    })

    it('should include description if provided', () => {
      const content = createPopupContent({
        incidentType: 'fire',
        severity: 'critical',
        timeAgo: '30 minutes ago',
        description: 'Building on fire',
      })

      expect(content).toContain('Building on fire')
      expect(content).toContain('disaster-popup-description')
    })

    it('should not include description if not provided', () => {
      const content = createPopupContent({
        incidentType: 'earthquake',
        severity: 'high',
        timeAgo: '5 minutes ago',
      })

      expect(content).not.toContain('disaster-popup-description')
    })

    it('should use correct severity class', () => {
      const highContent = createPopupContent({
        incidentType: 'flood',
        severity: 'high',
        timeAgo: '1 hour ago',
      })

      const mediumContent = createPopupContent({
        incidentType: 'landslide',
        severity: 'medium',
        timeAgo: '2 hours ago',
      })

      const lowContent = createPopupContent({
        incidentType: 'typhoon',
        severity: 'low',
        timeAgo: '3 hours ago',
      })

      expect(highContent).toContain('disaster-popup-severity-high')
      expect(mediumContent).toContain('disaster-popup-severity-medium')
      expect(lowContent).toContain('disaster-popup-severity-low')
    })
  })
})
