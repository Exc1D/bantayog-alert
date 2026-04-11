import { useEffect, useState } from 'react'
import L from 'leaflet'
import { useLeafletMap } from '../hooks/useLeafletMap'
import { useGeolocation } from '@/shared/hooks/useGeolocation'
import { createUserLocationIcon, USER_LOCATION_MARKER_CSS } from '../utils/markerIcons'
import 'leaflet/dist/leaflet.css'

// Camarines Norte coordinates
const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842]
const DEFAULT_ZOOM = 10

export interface MapViewProps {
  center?: [number, number]
  zoom?: number
}

/**
 * MapView component that renders a Leaflet map with OpenStreetMap tiles.
 * Displays user's current location with a pulsing blue marker and accuracy circle.
 *
 * @param center - Map center coordinates [latitude, longitude]
 * @param zoom - Initial zoom level (default: 10)
 */
export function MapView({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM }: MapViewProps) {
  const { mapContainerRef, mapInstanceRef, isReady } = useLeafletMap({
    center,
    zoom,
  })

  const { coordinates, loading: locationLoading, error: locationError } = useGeolocation()
  const [userMarker, setUserMarker] = useState<L.Marker | null>(null)
  const [accuracyCircle, setAccuracyCircle] = useState<L.Circle | null>(null)

  // Inject custom CSS for user location marker
  useEffect(() => {
    const styleId = 'user-location-marker-styles'
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style')
      style.id = styleId
      style.textContent = USER_LOCATION_MARKER_CSS
      document.head.appendChild(style)
    }
  }, [])

  // Add user location marker when coordinates are available
  useEffect(() => {
    if (!isReady || !mapInstanceRef.current) {
      return
    }

    const map = mapInstanceRef.current

    // Remove existing marker and circle
    if (userMarker) {
      map.removeLayer(userMarker)
      setUserMarker(null)
    }
    if (accuracyCircle) {
      map.removeLayer(accuracyCircle)
      setAccuracyCircle(null)
    }

    // Add marker if coordinates are available
    if (coordinates && !locationError) {
      const userLatLng: L.LatLngExpression = [coordinates.latitude, coordinates.longitude]

      // Create user location marker
      const marker = L.marker(userLatLng, {
        icon: createUserLocationIcon(),
        zIndexOffset: 1000, // Ensure marker appears on top
      })

      // Add click handler to center map on user location
      marker.on('click', () => {
        map.setView(userLatLng, 15, { animate: true })
      })

      marker.addTo(map)
      setUserMarker(marker)

      // Create accuracy circle (if we had accuracy data from geolocation)
      // Note: Current useGeolocation hook doesn't return accuracy, so we use a default
      const circle = L.circle(userLatLng, {
        radius: 100, // Default 100m radius
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        weight: 2,
        interactive: false, // Don't block clicks to the marker
      })

      circle.addTo(map)
      setAccuracyCircle(circle)
    }
  }, [isReady, mapInstanceRef, coordinates, locationError])

  useEffect(() => {
    // Placeholder for disaster layer initialization
    // This will be implemented in a future task
    if (isReady && mapInstanceRef.current) {
      // TODO: Add disaster layer overlay
    }
  }, [isReady, mapInstanceRef])

  return (
    <div className="relative w-full h-screen">
      {/* Loading state */}
      {!isReady && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100"
          data-testid="map-loading"
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4" />
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      {/* Map container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        data-testid="map-view"
        style={{ height: '100vh', width: '100%' }}
      />

      {/* Location error state */}
      {isReady && locationError && (
        <div
          className="absolute bottom-4 left-4 right-4 z-[1000] bg-red-50 border border-red-200 rounded-lg shadow-lg p-4"
          data-testid="location-error"
        >
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800">Location Unavailable</p>
              <p className="text-xs text-red-700 mt-1">
                {locationError === 'PERMISSION_DENIED'
                  ? 'Please enable location permissions to see your position on the map.'
                  : locationError === 'GEOLOCATION_UNSUPPORTED'
                  ? 'Your browser does not support geolocation.'
                  : 'Unable to retrieve your location.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User location info */}
      {isReady && coordinates && !locationError && (
        <div
          className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3"
          data-testid="user-location-info"
        >
          <div className="flex items-center text-xs text-gray-600">
            <svg
              className="w-4 h-4 mr-2 text-primary-blue"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Your location</span>
          </div>
        </div>
      )}

      {/* Location loading indicator */}
      {isReady && locationLoading && (
        <div
          className="absolute bottom-4 left-4 z-[1000] bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-3"
          data-testid="location-loading"
        >
          <div className="flex items-center text-xs text-blue-700">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Getting your location...</span>
          </div>
        </div>
      )}

      {/* Placeholder for disaster layer controls */}
      {isReady && (
        <div
          className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4"
          data-testid="map-controls-placeholder"
        >
          <p className="text-sm text-gray-600">Disaster layer controls coming soon</p>
        </div>
      )}
    </div>
  )
}
