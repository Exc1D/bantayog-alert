import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { FilterBar } from './FilterBar.js'
import { PeekSheet } from './PeekSheet.js'
import { DetailSheet } from './DetailSheet.js'
import { IncidentLayer } from './IncidentLayer.js'
import { MyReportLayer } from './MyReportLayer.js'
import { usePublicIncidents } from '../../hooks/usePublicIncidents.js'
import { useMyActiveReports } from '../../hooks/useMyActiveReports.js'
import type { Filters, MyReport, PublicIncident } from './types.js'

const DAET_CENTER: [number, number] = [14.1115, 122.9558]
const DEFAULT_ZOOM = 13

const INCIDENT_LABELS: Record<string, string> = {
  flood: 'Flood',
  fire: 'Fire',
  earthquake: 'Earthquake',
  typhoon: 'Typhoon',
  landslide: 'Landslide',
  storm_surge: 'Storm Surge',
  medical: 'Medical',
  accident: 'Accident',
  structural: 'Structural',
  security: 'Security',
  other: 'Other',
}

interface SelectedPin {
  id: string
  type: 'incident' | 'myReport'
  label: string
}

function severityLabel(severity: Filters['severity'] | MyReport['severity']): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

function toMapProgressLabel(report: MyReport['status']): string {
  if (report === 'queued' || report === 'draft_inbox' || report === 'new') return 'Awaiting Review'
  return statusLabel(report)
}

export function MapTab() {
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)
  const [filters, setFilters] = useState<Filters>({ severity: 'all', window: '24h' })
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null)
  const [sheetPhase, setSheetPhase] = useState<'hidden' | 'peek' | 'expanded'>('hidden')

  const {
    incidents,
    loading: incidentsLoading,
    error: incidentsError,
  } = usePublicIncidents(filters)
  const { reports: myReports, loading: myReportsLoading } = useMyActiveReports()

  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return

    const map = L.map(mapElRef.current, {
      center: DAET_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    map.on('click', () => {
      setSelectedPin(null)
      setSheetPhase('hidden')
    })

    mapRef.current = map
    setMapInstance(map)

    return () => {
      map.off()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }

    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const suppressedIds = useMemo(
    () => new Set(myReports.flatMap((report) => (report.id ? [report.id] : []))),
    [myReports],
  )

  const visibleIncidents = useMemo(
    () => incidents.filter((incident) => !suppressedIds.has(incident.id)),
    [incidents, suppressedIds],
  )

  const selectedIncident = useMemo(
    () =>
      selectedPin?.type === 'incident'
        ? (visibleIncidents.find((incident) => incident.id === selectedPin.id) ?? null)
        : null,
    [selectedPin, visibleIncidents],
  )

  const selectedMyReport = useMemo(
    () =>
      selectedPin?.type === 'myReport'
        ? (myReports.find((report) => report.publicRef === selectedPin.id) ?? null)
        : null,
    [myReports, selectedPin],
  )

  useEffect(() => {
    if (!selectedPin) return undefined

    const missingSelectedItem =
      (selectedPin.type === 'incident' && !selectedIncident) ||
      (selectedPin.type === 'myReport' && !selectedMyReport)

    if (!missingSelectedItem) return undefined

    const timeout = window.setTimeout(() => {
      setSelectedPin(null)
      setSheetPhase('hidden')
    }, 0)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [selectedIncident, selectedMyReport, selectedPin])

  const handleIncidentTap = useCallback((incident: PublicIncident) => {
    setSelectedPin({
      id: incident.id,
      type: 'incident',
      label: `${INCIDENT_LABELS[incident.reportType] ?? incident.reportType} · ${severityLabel(incident.severity)} · ${incident.barangayId}, ${incident.municipalityLabel}`,
    })
    setSheetPhase('peek')
  }, [])

  const handleMyReportTap = useCallback((report: MyReport) => {
    setSelectedPin({
      id: report.publicRef,
      type: 'myReport',
      label: `★ ${INCIDENT_LABELS[report.reportType] ?? report.reportType} · ${toMapProgressLabel(report.status)}`,
    })
    setSheetPhase('peek')
  }, [])

  const showEmpty =
    !incidentsLoading &&
    !myReportsLoading &&
    !incidentsError &&
    visibleIncidents.length === 0 &&
    myReports.length === 0

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        paddingTop: 64,
        paddingBottom: 88,
        boxSizing: 'border-box',
      }}
    >
      <div ref={mapElRef} style={{ width: '100%', height: '100%' }} />

      {mapInstance ? (
        <>
          <IncidentLayer
            map={mapInstance}
            incidents={visibleIncidents}
            suppressedIds={suppressedIds}
            onPinTap={handleIncidentTap}
          />
          <MyReportLayer map={mapInstance} reports={myReports} onPinTap={handleMyReportTap} />
        </>
      ) : null}

      <FilterBar filters={filters} onChange={setFilters} disabled={isOffline} />

      {showEmpty ? (
        <div
          role="status"
          style={{
            position: 'absolute',
            inset: '50% auto auto 50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            maxWidth: 280,
            padding: '20px 24px',
            borderRadius: 12,
            background: 'var(--color-surface-container-low)',
            boxShadow: '0 4px 24px rgba(0,30,64,0.12)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, color: 'var(--color-on-surface-variant)' }}>
            No reported incidents in this area in the last {filters.window}.
          </p>
        </div>
      ) : null}

      {isOffline ? (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 'auto 0 88px',
            zIndex: 30,
            padding: '8px 16px',
            background: 'rgba(0,30,64,0.9)',
            color: '#fff',
            textAlign: 'center',
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.8rem',
          }}
        >
          📶 Offline — map data may be outdated
        </div>
      ) : null}

      <PeekSheet
        sheetPhase={sheetPhase}
        pin={selectedPin}
        onExpand={() => {
          setSheetPhase('expanded')
        }}
        onDismiss={() => {
          setSheetPhase('hidden')
          setSelectedPin(null)
        }}
      />

      {sheetPhase === 'expanded' && selectedIncident ? (
        <DetailSheet
          mode="public"
          incident={selectedIncident}
          sheetPhase={sheetPhase}
          onClose={() => {
            setSheetPhase('hidden')
            setSelectedPin(null)
          }}
          onCollapse={() => {
            setSheetPhase('peek')
          }}
        />
      ) : null}

      {sheetPhase === 'expanded' && selectedMyReport ? (
        <DetailSheet
          mode="myReport"
          report={selectedMyReport}
          sheetPhase={sheetPhase}
          onClose={() => {
            setSheetPhase('hidden')
            setSelectedPin(null)
          }}
          onCollapse={() => {
            setSheetPhase('peek')
          }}
        />
      ) : null}
    </div>
  )
}
