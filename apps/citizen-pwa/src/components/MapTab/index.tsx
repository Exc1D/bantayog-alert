import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crosshair } from 'lucide-react'
import L from 'leaflet'
import { PeekSheet } from './PeekSheet.js'
import { DetailSheet } from './DetailSheet.js'
import { DeleteSheet } from '../DeleteSheet.js'
import { FilterBar } from './FilterBar.js'
import { IncidentLayer } from './IncidentLayer.js'
import { MyReportLayer } from './MyReportLayer.js'
import { usePublicIncidents } from '../../hooks/usePublicIncidents.js'
import { useMyActiveReports } from '../../hooks/useMyActiveReports.js'
import { cancelReport } from '../../services/callables.js'
import { deleteReport } from '../../services/localForageReports.js'
import { useToast } from '../../hooks/useToast.js'
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
  accident: 'Accidents/Rescue',
  structural: 'Damages',
  security: 'Security',
  other: 'Others',
}

interface SelectedPin {
  id: string
  type: 'incident' | 'myReport'
  label: string
  severity?: 'high' | 'medium' | 'low'
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

function toMapProgressLabel(report: MyReport['status']): string {
  if (report === 'queued' || report === 'draft_inbox' || report === 'new') return 'Awaiting Review'
  return statusLabel(report)
}

export function MapTab() {
  const navigate = useNavigate()
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)
  const [filters, setFilters] = useState<Filters>({ municipality: '' })
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null)
  const [sheetPhase, setSheetPhase] = useState<'hidden' | 'peek' | 'expanded'>('hidden')
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false)

  const {
    incidents,
    loading: incidentsLoading,
    error: incidentsError,
  } = usePublicIncidents(filters)
  const { reports: myReports, loading: myReportsLoading } = useMyActiveReports()
  const { toast } = useToast()

  const handleCancelReport = useCallback(
    (publicRef: string, reportId?: string) => {
      void (async () => {
        // For queued reports without a Firestore ID, skip backend cancel
        if (reportId) {
          try {
            await cancelReport(reportId)
            toast('Report cancelled', 'success')
          } catch {
            toast('Failed to cancel report', 'error')
            return
          }
        }
        setSheetPhase('hidden')
        setSelectedPin(null)
        try {
          await deleteReport(publicRef)
        } catch (err: unknown) {
          console.warn('Failed to cleanup local report cache after cancel', {
            publicRef,
            err,
          })
        }
      })()
    },
    [toast],
  )

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

    // Recalculate tile layout whenever the container resizes (covers the initial
    // layout settle and any future resize events like the offline banner appearing).
    const ro = new ResizeObserver(() => {
      map.invalidateSize()
    })
    ro.observe(mapElRef.current)

    return () => {
      ro.disconnect()
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
      severity: incident.severity,
      label: `${INCIDENT_LABELS[incident.reportType] ?? incident.reportType} · ${incident.severity} · ${incident.barangayId}, ${incident.municipalityLabel}`,
    })
    setSheetPhase('peek')
  }, [])

  const handleMyReportTap = useCallback((report: MyReport) => {
    setSelectedPin({
      id: report.publicRef,
      type: 'myReport',
      label: `Your report: ${INCIDENT_LABELS[report.reportType] ?? report.reportType} · ${toMapProgressLabel(report.status)}`,
    })
    setSheetPhase('peek')
  }, [])

  const handleRecenter = useCallback(() => {
    mapRef.current?.flyTo(DAET_CENTER, DEFAULT_ZOOM, { duration: 1 })
  }, [])

  const showEmpty =
    !incidentsLoading &&
    !myReportsLoading &&
    !incidentsError &&
    visibleIncidents.length === 0 &&
    myReports.length === 0

  const showFilterHint =
    !incidentsLoading &&
    !incidentsError &&
    visibleIncidents.length === 0 &&
    (myReports.length > 0 || filters.municipality !== '')

  return (
    <div className="absolute inset-0 isolate">
      <div ref={mapElRef} className="w-full h-full" />

      <div className="absolute top-0 left-0 right-0 z-[800] px-3 pt-3 pointer-events-none">
        <div className="pointer-events-auto">
          <FilterBar filters={filters} onChange={setFilters} disabled={isOffline} />
        </div>
      </div>

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

      {/* Location FAB — shifts up when sheet is visible to avoid overlap */}
      <button
        type="button"
        onClick={handleRecenter}
        className={`absolute z-[800] w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-surface-900 active:scale-95 transition-transform ${sheetPhase === 'hidden' ? 'bottom-4 right-3' : 'bottom-[10rem] right-3'}`}
        aria-label="Recenter map"
      >
        <Crosshair size={20} />
      </button>

      {showEmpty || showFilterHint ? (
        <div
          role="status"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[800] max-w-[280px] px-6 py-5 rounded-xl bg-surface-100 shadow-lg text-center"
        >
          <p className="m-0 text-surface-600 text-sm">
            {filters.municipality
              ? `No reported incidents in ${filters.municipality} in the last 30 days. Try selecting All.`
              : `No reported incidents in this area in the last 30 days.`}
          </p>
        </div>
      ) : null}

      {isOffline ? (
        <div
          role="alert"
          className="absolute left-0 right-0 bottom-0 z-[800] px-4 py-2 bg-surface-900/90 text-white text-center text-[0.8rem]"
        >
          Offline — map data may be outdated
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
        {...(selectedPin?.type === 'myReport' &&
        selectedMyReport &&
        ['queued', 'new', 'awaiting_verify'].includes(selectedMyReport.status)
          ? {
              onDelete: () => {
                setDeleteSheetOpen(true)
              },
            }
          : {})}
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
          onReportSimilar={() => {
            void navigate('/report')
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
          onCancelReport={handleCancelReport}
        />
      ) : null}

      <DeleteSheet
        open={deleteSheetOpen}
        publicRef={selectedMyReport?.publicRef ?? ''}
        reportType={
          selectedMyReport
            ? (INCIDENT_LABELS[selectedMyReport.reportType] ?? selectedMyReport.reportType)
            : ''
        }
        onConfirm={() => {
          setDeleteSheetOpen(false)
          if (selectedMyReport) {
            handleCancelReport(selectedMyReport.publicRef, selectedMyReport.id)
          }
        }}
        onCancel={() => {
          setDeleteSheetOpen(false)
        }}
      />
    </div>
  )
}
