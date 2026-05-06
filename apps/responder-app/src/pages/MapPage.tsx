import { useEffect, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { useReport } from '../hooks/useReport'
import styles from './MapPage.module.css'

// Fix Leaflet default icon broken in Vite/Webpack
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const incidentIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: 'incident-marker',
})

// Daet, Camarines Norte default center
const DEFAULT_CENTER: [number, number] = [14.1131, 122.9553]

interface Coords {
  lat: number
  lng: number
}

function MapFlyTo({ coords }: { coords: Coords | null }) {
  const map = useMap()
  useEffect(() => {
    if (coords) {
      map.setView([coords.lat, coords.lng], 15)
    }
  }, [coords, map])
  return null
}

function ActiveDispatchMarker({ reportId }: { reportId: string }) {
  const { report } = useReport(reportId)
  if (!report?.publicLocation) return null
  const lat = report.publicLocation.latitude
  const lng = report.publicLocation.longitude
  return (
    <Marker position={[lat, lng]} icon={incidentIcon}>
      <Popup>
        <strong>{report.reportType}</strong>
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

  useEffect(() => {
    // happy-dom (vitest) leaves navigator.geolocation as null even though
    // browser DOM types say it's always present.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setOwnLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        console.warn('[MapPage] geolocation error:', err)
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    return () => {
      navigator.geolocation.clearWatch(id)
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
        <MapFlyTo coords={ownLocation} />
        {ownLocation && (
          <Marker position={[ownLocation.lat, ownLocation.lng]} icon={defaultIcon}>
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
    </div>
  )
}
