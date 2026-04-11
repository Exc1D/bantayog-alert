import L from 'leaflet'

/**
 * Creates a pulsing blue user location marker icon.
 * Uses a divIcon with CSS animation for the pulsing effect.
 *
 * @returns Leaflet DivIcon with pulsing blue circle
 */
export function createUserLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="user-location-marker-container">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

/**
 * Custom CSS for user location marker.
 * Import this in the component that uses the marker.
 */
export const USER_LOCATION_MARKER_CSS = `
  .user-location-marker {
    background: transparent;
    border: none;
  }

  .user-location-marker-container {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .user-location-dot {
    position: absolute;
    width: 16px;
    height: 16px;
    background-color: #3b82f6;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    z-index: 2;
  }

  .user-location-pulse {
    position: absolute;
    width: 40px;
    height: 40px;
    background-color: rgba(59, 130, 246, 0.3);
    border-radius: 50%;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    z-index: 1;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(0.8);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.5;
    }
  }
`
