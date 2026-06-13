import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { cancelReport } from '../../services/callables.js'
import { deleteReport } from '../../services/localForageReports.js'
import { useToast } from '../../hooks/useToast.js'
import { usePublicIncidents } from '../../hooks/usePublicIncidents.js'
import { useMyActiveReports } from '../../hooks/useMyActiveReports.js'
import type { Filters } from './types.js'

const DAET_CENTER: [number, number] = [14.1115, 122.9558]
const DEFAULT_ZOOM = 13

export interface SelectedPin {
  id: string
  type: 'incident' | 'myReport'
  label: string
  severity?: 'high' | 'medium' | 'low'
}

export type SheetPhase = 'hidden' | 'peek' | 'expanded'

export function useMapTab(mapElRef: React.RefObject<HTMLDivElement | null>) {
  const navigate = useNavigate()
  const mapRef = useRef<L.Map | null>(null)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine)
  const [filters, setFilters] = useState<Filters>({ municipality: '' })
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null)
  const [sheetPhase, setSheetPhase] = useState<SheetPhase>('hidden')
  const [deleteSheetOpen, setDeleteSheetOpen] = useState(false)

  const {
    incidents,
    loading: incidentsLoading,
    error: incidentsError,
  } = usePublicIncidents(filters)
  const { reports: myReports, loading: myReportsLoading } = useMyActiveReports()
  const { toast } = useToast()

  /* ── Map lifecycle ──────────────────────────────────────── */

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
  }, [mapElRef])

  /* ── Online/offline ─────────────────────────────────────── */

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

  /* ── Derived data ───────────────────────────────────────── */

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

  /* ── Selection cleanup ───────────────────────────────────── */

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

  /* ── Handlers ───────────────────────────────────────────── */

  const handleCancelReport = useCallback(
    (publicRef: string, reportId?: string) => {
      void (async () => {
        if (reportId) {
          try {
            await cancelReport(reportId)
            toast('Your report was withdrawn and is no longer active.', 'success')
          } catch {
            toast('Failed to withdraw report', 'error')
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

  const handleRecenter = useCallback(() => {
    mapRef.current?.flyTo(DAET_CENTER, DEFAULT_ZOOM, { duration: 1 })
  }, [])

  const handleDismiss = useCallback(() => {
    setSheetPhase('hidden')
    setSelectedPin(null)
  }, [])

  const handleExpand = useCallback(() => {
    setSheetPhase('expanded')
  }, [])

  const handleCollapse = useCallback(() => {
    setSheetPhase('peek')
  }, [])

  const handleNavigateToReport = useCallback(() => {
    void navigate('/report')
  }, [navigate])

  const handleDeleteRequest = useCallback(() => {
    setDeleteSheetOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(() => {
    setDeleteSheetOpen(false)
    if (selectedMyReport) {
      handleCancelReport(selectedMyReport.publicRef, selectedMyReport.id)
    }
  }, [selectedMyReport, handleCancelReport])

  const handleDeleteCancel = useCallback(() => {
    setDeleteSheetOpen(false)
  }, [])

  /* ── Visibility flags ──────────────────────────────────── */

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

  return {
    mapInstance,
    isOffline,
    filters,
    setFilters,
    selectedPin,
    sheetPhase,
    deleteSheetOpen,
    visibleIncidents,
    myReports,
    selectedIncident,
    selectedMyReport,
    incidentsLoading,
    incidentsError,
    myReportsLoading,
    showEmpty,
    showFilterHint,
    handleRecenter,
    handleDismiss,
    handleExpand,
    handleCollapse,
    handleNavigateToReport,
    handleDeleteRequest,
    handleDeleteConfirm,
    handleDeleteCancel,
    setSelectedPin,
    setSheetPhase,
    setDeleteSheetOpen,
  }
}
