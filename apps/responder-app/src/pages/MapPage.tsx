import { useEffect, useRef, useMemo, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/* ------------------------------------------------------------------ */
/*  Responder location icon                                             */
/* ------------------------------------------------------------------ */

const ResponderIcon = L.divIcon({
  className: 'responder-location-marker',
  html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

/* ------------------------------------------------------------------ */
/*  Leaflet icon fix                                                    */
/* ------------------------------------------------------------------ */

// Fix Leaflet default icon paths
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

/* ------------------------------------------------------------------ */
/*  MapPage                                                             */
/* ------------------------------------------------------------------ */

export function MapPage() {
  const { user } = useAuth()
  const { rows } = useOwnDispatches(user?.uid)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)

  // Track responder's current location
  const [responderLocation, setResponderLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    let stopTracking: (() => Promise<void>) | null = null

    import('../services/telemetry-client.js').then(({ startTracking }) => {
      startTracking('', (loc) => {
        setResponderLocation({ lat: loc.lat, lng: loc.lng })
      }).then((stop) => {
        stopTracking = stop
      }).catch((err: unknown) => {
        console.warn('[MapPage] Failed to start location tracking:', err)
      })
    })

    return () => {
      if (stopTracking) {
        void stopTracking()
      }
    }
  }, [])

  // Get report data for dispatches with coordinates
  const dispatchWithCoords = useMemo(() => {
    return rows
      .filter((d) => d.status !== 'resolved' && d.status !== 'cancelled')
      .map((row) => ({
        dispatchId: row.dispatchId,
        reportId: row.reportId,
        status: row.status,
      }))
  }, [rows])

  // Fetch report data for coordinates
  const [reports, setReports] = useState<Record<string, { latitude?: number; longitude?: number; location: string }>>({})

  useEffect(() => {
    const reportIds = [...new Set(dispatchWithCoords.map((d) => d.reportId))]
    if (reportIds.length === 0) return

    Promise.all(
      reportIds.map(async (reportId) => {
        try {
          const { fetchReportData } = await import('../hooks/useReportData')
          const report = await fetchReportData(reportId)
          if (report) {
            const data: { latitude?: number; longitude?: number; location: string } = {
              location: report.location,
            }
            if (report.latitude != null) data.latitude = report.latitude
            if (report.longitude != null) data.longitude = report.longitude
            return { reportId, data }
          }
        } catch (err) {
          console.error('[MapPage] Failed to fetch report:', reportId, err)
        }
        return null
      })
    ).then((results) => {
      const data: Record<string, { latitude?: number; longitude?: number; location: string }> = {}
      results.forEach((result) => {
        if (result) {
          data[result.reportId] = result.data
        }
      })
      setReports(data)
    })
  }, [dispatchWithCoords])

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return

    const map = L.map(mapRef.current).setView([14.1131, 122.9553], 13)
    leafletMap.current = map

    // Add OpenStreetMap tile layer (free, no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    return () => {
      map.remove()
      leafletMap.current = null
    }
  }, [])

  // Add/update markers when reports change
  useEffect(() => {
    const map = leafletMap.current
    if (!map) return

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer)
      }
    })

    const bounds = L.latLngBounds([])
    let hasMarkers = false

    dispatchWithCoords.forEach((dispatch) => {
      const report = reports[dispatch.reportId]
      if (report && report.latitude && report.longitude) {
        L.marker([report.latitude, report.longitude])
          .addTo(map)
          .bindPopup(`<b>${dispatch.reportId.slice(0, 8)}</b><br/>${report.location}`)
        bounds.extend([report.latitude, report.longitude])
        hasMarkers = true
      }
    })

    // Add responder location marker if available
    if (responderLocation) {
      L.marker([responderLocation.lat, responderLocation.lng], { icon: ResponderIcon })
        .addTo(map)
        .bindPopup('Your location')
      bounds.extend([responderLocation.lat, responderLocation.lng])
      hasMarkers = true
    }

    if (hasMarkers) {
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [dispatchWithCoords, reports, responderLocation])

  return (
    <div className="h-full flex flex-col">
      {/* Map area */}
      <div ref={mapRef} className="relative flex-1 min-h-0 bg-app-surface-elevated">
        {/* Map is rendered by Leaflet */}
      </div>

      {/* Controls below map */}
      <div className="px-app-lg py-app-md bg-app-bg border-t border-app-border">
        {/* Legend */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-app-urgent" />
            <span className="text-app-xs text-app-text-secondary">Assigned incidents</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
            <span className="text-app-xs text-app-text-secondary">Your location</span>
          </div>
        </div>

        <p className="text-app-xs text-app-text-muted">
          Tap a marker to see incident details. Use your device's native maps app for turn-by-turn navigation.
        </p>
      </div>
    </div>
  )
}
