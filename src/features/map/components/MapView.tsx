import { useEffect } from 'react'
import { useLeafletMap } from '../hooks/useLeafletMap'
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
 * Provides placeholders for disaster layers and user location markers.
 *
 * @param center - Map center coordinates [latitude, longitude]
 * @param zoom - Initial zoom level (default: 10)
 */
export function MapView({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM }: MapViewProps) {
  const { mapContainerRef, mapInstanceRef, isReady } = useLeafletMap({
    center,
    zoom,
  })

  useEffect(() => {
    // Placeholder for disaster layer initialization
    // This will be implemented in a future task
    if (isReady && mapInstanceRef.current) {
      // TODO: Add disaster layer overlay
      // TODO: Add user location marker
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
