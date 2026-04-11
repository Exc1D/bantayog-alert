import { useState, useCallback, useRef } from 'react'
import L from 'leaflet'

export interface MapControlsOptions {
  minZoom?: number
  maxZoom?: number
  onLayerToggle?: (layerType: 'standard' | 'satellite') => void
}

export interface UseMapControlsReturn {
  currentZoom: number
  layerType: 'standard' | 'satellite'
  zoomIn: () => void
  zoomOut: () => void
  locate: () => void
  toggleLayer: () => void
}

const DEFAULT_MIN_ZOOM = 8
const DEFAULT_MAX_ZOOM = 18

/**
 * Custom hook for map control handlers.
 * Manages zoom controls with limits, user location, and layer toggling.
 *
 * @param map - Leaflet map instance
 * @param options - Configuration options
 * @returns Control handlers and state
 */
export function useMapControls(
  map: L.Map | null,
  options: MapControlsOptions = {}
): UseMapControlsReturn {
  const { minZoom = DEFAULT_MIN_ZOOM, maxZoom = DEFAULT_MAX_ZOOM, onLayerToggle } = options

  const [currentZoom, setCurrentZoom] = useState<number>(map?.getZoom() ?? 10)
  const [layerType, setLayerType] = useState<'standard' | 'satellite'>('standard')

  // Track tile layers for switching
  const tileLayersRef = useRef<{
    standard?: L.TileLayer
    satellite?: L.TileLayer
  }>({})

  /**
   * Initialize tile layers
   */
  const initializeLayers = useCallback(() => {
    if (!map || tileLayersRef.current.standard) return

    // Standard OpenStreetMap layer
    const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })

    // Satellite layer (placeholder - using a different tile source for demo)
    // In production, this would use a real satellite imagery provider
    const satelliteLayer = L.tileLayer('https://{s}.tile.openstreet.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'leaflet-layer-satellite', // CSS class for satellite effect
    })

    tileLayersRef.current = {
      standard: standardLayer,
      satellite: satelliteLayer,
    }

    // Add standard layer by default
    standardLayer.addTo(map)

    // Update zoom when map zoom changes
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom())
    })

    setCurrentZoom(map.getZoom())
  }, [map])

  // Initialize layers when map is ready
  if (map && !tileLayersRef.current.standard) {
    initializeLayers()
  }

  /**
   * Zoom in by one level, respecting max zoom limit
   */
  const zoomIn = useCallback(() => {
    if (!map) return

    const newZoom = Math.min(currentZoom + 1, maxZoom)
    map.setZoom(newZoom)
    setCurrentZoom(newZoom)
  }, [map, currentZoom, maxZoom])

  /**
   * Zoom out by one level, respecting min zoom limit
   */
  const zoomOut = useCallback(() => {
    if (!map) return

    const newZoom = Math.max(currentZoom - 1, minZoom)
    map.setZoom(newZoom)
    setCurrentZoom(newZoom)
  }, [map, currentZoom, minZoom])

  /**
   * Center map on user's location with smooth animation
   */
  const locate = useCallback(() => {
    if (!map) return

    if (navigator && navigator.geolocation && navigator.geolocation.getCurrentPosition) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          map.flyTo([latitude, longitude], 15, {
            animate: true,
            duration: 1.5, // 1.5 seconds animation
          })
        },
        (error) => {
          console.error('Geolocation error:', error)
          // Fall back to current center if geolocation fails
          try {
            const center = map.getCenter()
            map.flyTo(center, currentZoom, {
              animate: true,
              duration: 1,
            })
          } catch (e) {
            // If getCenter fails, just log and continue
            console.error('Failed to get map center:', e)
          }
        }
      )
    }
  }, [map, currentZoom])

  /**
   * Toggle between standard and satellite layers
   */
  const toggleLayer = useCallback(() => {
    if (!map || !tileLayersRef.current.standard || !tileLayersRef.current.satellite) {
      return
    }

    const { standard, satellite } = tileLayersRef.current
    const newLayerType = layerType === 'standard' ? 'satellite' : 'standard'

    // Remove current layer
    if (layerType === 'standard' && map.hasLayer(standard)) {
      map.removeLayer(standard)
    } else if (layerType === 'satellite' && map.hasLayer(satellite)) {
      map.removeLayer(satellite)
    }

    // Add new layer
    if (newLayerType === 'standard') {
      standard.addTo(map)
    } else {
      satellite.addTo(map)
    }

    setLayerType(newLayerType)
    onLayerToggle?.(newLayerType)
  }, [map, layerType, onLayerToggle])

  return {
    currentZoom,
    layerType,
    zoomIn,
    zoomOut,
    locate,
    toggleLayer,
  }
}
