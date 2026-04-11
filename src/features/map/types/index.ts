/**
 * Map feature types
 *
 * Types specific to the map feature, including disaster reports and markers.
 */

import type { IncidentSeverity, IncidentType } from '@/shared/types/firestore.types'

/**
 * Disaster report for map display
 *
 * Simplified version of Report for map rendering.
 */
export interface DisasterReport {
  id: string
  incidentType: IncidentType
  severity: IncidentSeverity
  status: string
  timestamp: number
  location: {
    latitude: number
    longitude: number
  }
  description?: string
}

/**
 * Severity colors for map markers
 */
export const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  high: '#dc2626',      // Red
  medium: '#f59e0b',    // Orange
  low: '#eab308',       // Yellow
  critical: '#7f1d1d',  // Dark red
}

/**
 * Marker popup data
 */
export interface MarkerPopupData {
  reportId: string
  incidentType: IncidentType
  severity: IncidentSeverity
  timeAgo: string
  description?: string
}
