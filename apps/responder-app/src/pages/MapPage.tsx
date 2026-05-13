import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Crosshair } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { useReport } from '../hooks/useReport'
import { getReportTypeLabel } from '../lib/incident-labels'
import styles from './MapPage.module.css'

// Inline SVG / HTML markers so the responder app stays usable offline
// (no unpkg/cdn dependency). Mirrors apps/citizen-pwa IncidentLayer pattern.
const responderIcon = L.divIcon({
  className: 'bantayog-responder-marker',
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function getSeverityColor(severity: 'low' | 'medium' | 'high' | undefined): string {
  if (severity === 'high') return '#991b1b'
  if (severity === 'medium') return '#92400e'
  return '#065f46'
}

function buildIncidentIcon(severity: 'low' | 'medium' | 'high' | undefined): L.DivIcon {
  const fill = getSeverityColor(severity)
  return L.divIcon({
    className: 'bantayog-incident-marker',
    html: `<div style="width:22px;height:22px;border-radius:4px;background:${fill};border:2px solid var(--text-primary);box-shadow:0 1px 4px rgba(0,0,0,0.3);transform:rotate(45deg);"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Daet, Camarines Norte default center
const DEFAULT_CENTER: [number, number] = [14.1131, 122.9553]

interface Coords {
  lat: number
  lng: number
}

function MapFlyTo({ coords, recenterRequest }: { coords: Coords | null; recenterRequest: number }) {
  const map = useMap()
  const flownRef = useRef(false)

  useEffect(() => {
    if (coords && !flownRef.current) {
      map.setView([coords.lat, coords.lng], 15)
      flownRef.current = true
    }
  }, [coords, map])

  useEffect(() => {
    if (recenterRequest === 0 || !coords) return
    map.setView([coords.lat, coords.lng], 15)
  }, [recenterRequest, coords, map])

  return null
}

function ActiveDispatchMarker({ reportId }: { reportId: string }) {
  const { report } = useReport(reportId)
  if (!report?.publicLocation) return null
  const lat = report.publicLocation.latitude
  const lng = report.publicLocation.longitude
  return (
    <Marker position={[lat, lng]} icon={buildIncidentIcon(report.severity)}>
      <Popup>
        <strong>{getReportTypeLabel(report.reportType)}</strong>
        <br />
        {report.severity} severity
        <br />
        {report.municipalityLabel ?? report.municipalityId}
        <br />
        <a
          href={`https://maps.google.com/?q=${String(lat)},${String(lng)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Navigate here
        </a>
      </Popup>
    </Marker>
  )
}

export function MapPage() {
  const { user } = useAuth()
  const { groups } = useOwnDispatches(user?.uid)
  const [ownLocation, setOwnLocation] = useState<Coords | null>(null)
  const [recenterRequest, setRecenterRequest] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!navigator.geolocation) return
    let watchId: number | null = null

    const startWatch = () => {
      if (watchId !== null) return
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setOwnLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        },
        (err) => {
          console.warn('[MapPage] geolocation error:', err)
        },
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
      )
    }

    const stopWatch = () => {
      if (watchId === null) return
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stopWatch()
      else startWatch()
    }

    startWatch()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopWatch()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const allActive = [...groups.pending, ...groups.active]
  const center: [number, number] = ownLocation ? [ownLocation.lat, ownLocation.lng] : DEFAULT_CENTER

  return (
    <div className={styles.page}>
      <MapContainer
        center={center}
        zoom={ownLocation ? 15 : 12}
        style={{ height: '100%', width: '100%' }}
        className={styles.mapContainer ?? ''}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFlyTo coords={ownLocation} recenterRequest={recenterRequest} />
        {ownLocation && (
          <Marker position={[ownLocation.lat, ownLocation.lng]} icon={responderIcon}>
            <Popup>Your location</Popup>
          </Marker>
        )}
        {allActive.map((row) => (
          <ActiveDispatchMarker key={row.dispatchId} reportId={row.reportId} />
        ))}
      </MapContainer>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span
            className={[styles.dot, styles.dotBlue].filter(Boolean).join(' ')}
            aria-hidden="true"
          />
          <span>Your location</span>
        </div>
        <div className={styles.legendItem}>
          <span
            className={[styles.dot, styles.dotRed].filter(Boolean).join(' ')}
            aria-hidden="true"
          />
          <span>Incident pin</span>
        </div>
      </div>

      <button
        type="button"
        className={styles.recenterBtn ?? ''}
        onClick={() => {
          setRecenterRequest((n) => n + 1)
        }}
        disabled={!ownLocation}
        aria-label="Recenter map on your location"
      >
        <Crosshair size={16} aria-hidden="true" /> Recenter
      </button>
    </div>
  )
}
