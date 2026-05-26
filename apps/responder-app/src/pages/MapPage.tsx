import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import {
  AlertTriangle,
  Building,
  Car,
  CheckCircle,
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

const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function MapFlyTo({ coords, recenterRequest }: { coords: Coords | null; recenterRequest: number }) {
  const map = useMap()
  const flownRef = useRef(false)

  useEffect(() => {
    if (coords && !flownRef.current) {
      map.setView([coords.lat, coords.lng], 15, { animate: !REDUCED_MOTION })
      flownRef.current = true
    }
  }, [coords, map])

  useEffect(() => {
    if (recenterRequest === 0 || !coords) return
    map.setView([coords.lat, coords.lng], 15, { animate: !REDUCED_MOTION })
  }, [recenterRequest, coords, map])

  return null
}

function capitalize(s: string): string {
  if (s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ActiveDispatchMarker({ reportId }: { reportId: string }) {
  const { report } = useReport(reportId)
  const markerRef = useRef<L.Marker | null>(null)
  if (!report?.publicLocation) return null
  const lat = report.publicLocation.latitude
  const lng = report.publicLocation.longitude
  const label = getReportTypeLabel(report.reportType)
  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={buildIncidentIcon(report.severity, report.reportType)}
      keyboard
      eventHandlers={{
        keydown: (e: L.LeafletEvent) => {
          const ke = (e as unknown as { originalEvent?: KeyboardEvent }).originalEvent
          if (ke?.key === 'Enter' || ke?.key === ' ') {
            ke.preventDefault()
            markerRef.current?.openPopup()
          }
        },
        popupopen: () => {
          const popup = markerRef.current?.getPopup()
          const el = popup?.getElement()
          const focusable = el?.querySelector<HTMLElement>('a[href], button')
          focusable?.focus()
        },
      }}
    >
      <Popup>
        <strong>{label}</strong>
        <br />
        {capitalize(report.severity)} severity
        <br />
        {report.municipalityLabel ?? 'Unknown location'}
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

type GpsErrorState = 'denied' | 'unavailable' | null

export function MapPage() {
  const { user } = useAuth()
  const { groups, loading, error, retry } = useOwnDispatches(user?.uid)
  const [ownLocation, setOwnLocation] = useState<Coords | null>(null)
  const [gpsError, setGpsError] = useState<GpsErrorState>(null)
  const [recenterRequest, setRecenterRequest] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!navigator.geolocation) {
      queueMicrotask(() => {
        setGpsError('unavailable')
      })
      return
    }
    let watchId: number | null = null

    const startWatch = () => {
      if (watchId !== null) return
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setOwnLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          setGpsError(null)
        },
        (err) => {
          console.warn('[MapPage] geolocation error:', err)
          if (err.code === 1) {
            setGpsError('denied')
          } else {
            setGpsError('unavailable')
          }
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
  const showEmpty = !loading && error === null && allActive.length === 0

  return (
    <div className={styles.page}>
      <a href="#map-controls" className={styles.visuallyHiddenSkip}>
        Skip map, go to controls
      </a>
      <MapContainer
        center={center}
        zoom={ownLocation ? 15 : 12}
        style={{ height: '100%', width: '100%' }}
        className={styles.mapContainer ?? ''}
      >
        <TileLayer
          attribution='&amp;copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
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

      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <span className={styles.loadingText}>Loading dispatches…</span>
        </div>
      )}

      {error !== null && (
        <div role="alert" className={styles.errorBanner}>
          <p className={styles.errorBannerMessage}>Failed to load dispatches: {error}</p>
          <button type="button" className={styles.btnRetry} onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {showEmpty && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} role="img" aria-label="All clear">
            <CheckCircle size={48} strokeWidth={2} />
          </div>
          <h2 className={styles.emptyTitle}>All Clear!</h2>
          <p className={styles.emptyText}>
            No active dispatches on the map. Stay ready — new dispatches will appear here.
          </p>
          <Link to="/history" className={styles.emptyAction}>
            View Past Dispatches
          </Link>
        </div>
      )}

      {gpsError !== null && (
        <div role="status" className={styles.gpsBanner}>
          {gpsError === 'denied'
            ? 'Location access denied. Enable location in settings.'
            : 'Unable to get location. Check GPS or network.'}
        </div>
      )}

      <div className={styles.legend} id="map-controls">
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
          <span>
            Incident pin{' '}
            {allActive.length > 0 && <span className={styles.badge}>({allActive.length})</span>}
          </span>
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
