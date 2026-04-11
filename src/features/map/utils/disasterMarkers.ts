import L from 'leaflet'
import { SEVERITY_COLORS } from '../types'
import type { IncidentSeverity } from '@/shared/types/firestore.types'

/**
 * Creates a custom disaster marker icon with color based on severity.
 * Uses a circle with white border for visibility.
 *
 * @param severity - Incident severity level
 * @returns Leaflet DivIcon with colored circle
 */
export function createDisasterMarkerIcon(severity: IncidentSeverity): L.DivIcon {
  const color = SEVERITY_COLORS[severity]

  return L.divIcon({
    className: `disaster-marker disaster-marker-${severity}`,
    html: `
      <div class="disaster-marker-container">
        <div class="disaster-marker-circle" style="background-color: ${color};"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

/**
 * Custom CSS for disaster markers.
 * Import this in the component that uses disaster markers.
 */
export const DISASTER_MARKER_CSS = `
  .disaster-marker {
    background: transparent;
    border: none;
  }

  .disaster-marker-container {
    position: relative;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .disaster-marker-circle {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s ease;
  }

  .disaster-marker:hover .disaster-marker-circle {
    transform: scale(1.2);
  }

  /* Popup styling */
  .leaflet-popup-content-wrapper {
    border-radius: 8px;
    padding: 0;
  }

  .leaflet-popup-content {
    margin: 0;
    min-width: 200px;
  }

  .disaster-popup {
    padding: 12px;
  }

  .disaster-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .disaster-popup-title {
    font-weight: 600;
    font-size: 14px;
    color: #1f2937;
  }

  .disaster-popup-severity {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .disaster-popup-severity-high {
    background-color: #fee2e2;
    color: #991b1b;
  }

  .disaster-popup-severity-medium {
    background-color: #fef3c7;
    color: #92400e;
  }

  .disaster-popup-severity-low {
    background-color: #fef9c3;
    color: #854d0e;
  }

  .disaster-popup-severity-critical {
    background-color: #fecaca;
    color: #7f1d1d;
  }

  .disaster-popup-time {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
  }

  .disaster-popup-description {
    font-size: 13px;
    color: #4b5563;
    margin-top: 8px;
    line-height: 1.4;
  }
`

/**
 * Formats a timestamp as a relative time string (e.g., "2 hours ago").
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) {
    return 'just now'
  } else if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  } else if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  } else {
    return `${days} ${days === 1 ? 'day' : 'days'} ago`
  }
}

/**
 * Creates popup content for a disaster marker.
 *
 * @param data - Marker popup data
 * @returns HTML string for popup content
 */
export function createPopupContent(data: {
  incidentType: string
  severity: IncidentSeverity
  timeAgo: string
  description?: string
}): string {
  return `
    <div class="disaster-popup">
      <div class="disaster-popup-header">
        <span class="disaster-popup-title">${formatIncidentType(data.incidentType)}</span>
        <span class="disaster-popup-severity disaster-popup-severity-${data.severity}">
          ${data.severity}
        </span>
      </div>
      <div class="disaster-popup-time">${data.timeAgo}</div>
      ${data.description ? `<div class="disaster-popup-description">${data.description}</div>` : ''}
    </div>
  `
}

/**
 * Formats incident type for display.
 *
 * @param incidentType - Raw incident type
 * @returns Formatted incident type string
 */
function formatIncidentType(incidentType: string): string {
  return incidentType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
