import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import {
  AlertTriangle,
  Building,
  Car,
  CloudLightning,
  Crosshair,
  Flame,
  HeartPulse,
  Mountain,
  ShieldAlert,
  Waves,
  Wind,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { renderToString } from 'react-dom/server'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useOwnDispatches } from '../hooks/useOwnDispatches'
import { useReport } from '../hooks/useReport'
import { getReportTypeLabel } from '../lib/incident-labels'
import styles from './MapPage.module.css'

// Inline SVG / HTML markers so the responder app stays usable offline
// (no unpkg/cdn dependency). Mirrors admin-desktop's ops marker language.
const responderIcon = L.divIcon({
  className: 'bantayog-responder-marker',
  html: '<div data-pin-role="responder" style="width:12px;height:12px;border-radius:50%;background:var(--blue-responder);border:2px solid var(--text-primary);box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

function getSeverityColor(severity: 'low' | 'medium' | 'high' | undefined): string {
  if (severity === 'high') return 'var(--red-urgent)'
  if (severity === 'medium') return 'var(--amber-accent)'
  return '#334155'
}

const REPORT_TYPE_ICONS: Record<string, LucideIcon> = {
  flood: Waves,
  fire: Flame,
  earthquake: CloudLightning,
  typhoon: Wind,
  landslide: Mountain,
  storm_surge: Waves,
  medical: HeartPulse,
  accident: Car,
  structural: Building,
  security: ShieldAlert,
  other: AlertTriangle,
}

function getReportTypeIcon(reportType: string | undefined): LucideIcon {
  if (!reportType) return AlertTriangle
  return REPORT_TYPE_ICONS[reportType] ?? AlertTriangle
}

function buildIncidentIcon(
  severity: 'low' | 'medium' | 'high' | undefined,
  reportType: string | undefined,
): L.DivIcon {
  const fill = getSeverityColor(severity)
  const Icon = getReportTypeIcon(reportType)
  const html = renderToString(
    <div
      data-pin-role="incident"
      style={{
        width: 24,
        height: 24,
        backgroundColor: fill,
        borderRadius: '50%',
        border: '2px solid var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      }}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={2.5}
        style={{ width: 13, height: 13, color: 'var(--text-primary)' }}
      />
    </div>,
  )
  return L.divIcon({
    className: 'bantayog-incident-marker',
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
    <Marker position={[lat, lng]} icon={buildIncidentIcon(report.severity, report.reportType)}>
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
