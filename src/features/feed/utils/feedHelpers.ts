/**
 * Feed Helper Utilities
 *
 * Pure functions for formatting and processing feed data.
 */

/**
 * Truncates text to a specified length with ellipsis
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default: 150)
 * @returns Truncated text with ellipsis if shortened
 */
export function truncateText(text: string, maxLength = 150): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.slice(0, maxLength - 3).trim() + '...'
}

/**
 * Formats incident type for display
 *
 * @param incidentType - The incident type from the report
 * @returns Formatted display string (e.g., "Flood", "Medical Emergency")
 */
export function formatReportType(incidentType: string): string {
  const typeMap: Record<string, string> = {
    flood: 'Flood',
    earthquake: 'Earthquake',
    landslide: 'Landslide',
    fire: 'Fire',
    typhoon: 'Typhoon',
    medical_emergency: 'Medical Emergency',
    accident: 'Accident',
    infrastructure: 'Infrastructure Issue',
    crime: 'Crime',
    other: 'Other',
  }

  return typeMap[incidentType] || incidentType
}

/**
 * Formats coordinates to a readable location string
 *
 * @param coordinates - Geographic coordinates
 * @returns Formatted location string (e.g., "14.1234° N, 122.5678° E")
 */
export function formatLocationName(coordinates: {
  latitude: number
  longitude: number
}): string {
  const { latitude, longitude } = coordinates

  const latDirection = latitude >= 0 ? 'N' : 'S'
  const lngDirection = longitude >= 0 ? 'E' : 'W'

  const latAbs = Math.abs(latitude).toFixed(4)
  const lngAbs = Math.abs(longitude).toFixed(4)

  return `${latAbs}° ${latDirection}, ${lngAbs}° ${lngDirection}`
}

// Re-exported from shared utils so existing imports don't break
export { formatTimeAgo } from '@/shared/utils/formatTimeAgo'
