import { useRef, useEffect, useState } from 'react'
import L from 'leaflet'

interface MapConfig {
  center: [number, number]
  zoom: number
}

export interface UseLeafletMapReturn {
  mapContainerRef: React.RefObject<HTMLDivElement>
  mapInstanceRef: React.RefObject<L.Map | null>
  isReady: boolean
}

/**
 * Custom hook for initializing and managing a Leaflet map instance.
 * Handles map creation, tile layer setup, and cleanup on unmount.
 *
 * @param config - Map configuration with center coordinates and zoom level
 * @returns Map container ref, map instance ref, and ready state
 */
export function useLeafletMap(config: MapConfig): UseLeafletMapReturn {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [isReady, setIsReady] = useState<boolean>(false)

  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!mapContainerRef.current || mapInstanceRef.current) {
        return
      }

      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: config.center,
        zoom: config.zoom,
      })

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map
      setIsReady(true)
    }, 0)

    // Cleanup on unmount
    return () => {
      clearTimeout(timer)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        setIsReady(false)
      }
    }
  }, [config.center, config.zoom])

  const result: UseLeafletMapReturn = {
    mapContainerRef,
    mapInstanceRef,
    isReady,
  }
  return result
}
