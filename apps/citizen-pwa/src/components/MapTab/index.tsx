import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Crosshair } from 'lucide-react'
import { PeekSheet } from './PeekSheet.js'
import { DetailSheet } from './DetailSheet.js'
import { DeleteSheet } from '../DeleteSheet.js'
import { FilterBar } from './FilterBar.js'
import { IncidentLayer } from './IncidentLayer.js'
import { MyReportLayer } from './MyReportLayer.js'
import { WITHDRAWABLE_STATUSES } from '../ProfileTab.js'
import { useMapTab } from './useMapTab.js'
import type { PublicIncident, MyReport } from './types.js'

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
const LOOKUP_SUCCESS_MESSAGE = 'Report found — tracking enabled'

interface LookupNavigationState {
  selectedReportPublicRef?: unknown
  lookupSuccessMessage?: unknown
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

function toMapProgressLabel(report: MyReport['status']): string {
  if (report === 'queued' || report === 'draft_inbox' || report === 'new') return 'Awaiting Review'
  return statusLabel(report)
}

function buildIncidentPin(incident: PublicIncident): {
  id: string
  type: 'incident'
  label: string
  severity: 'high' | 'medium' | 'low'
} {
  return {
    id: incident.id,
    type: 'incident',
    severity: incident.severity,
    label: `${INCIDENT_LABELS[incident.reportType] ?? incident.reportType} · ${incident.severity} · ${incident.barangayId}, ${incident.municipalityLabel}`,
  }
}

function buildMyReportPin(report: MyReport): { id: string; type: 'myReport'; label: string } {
  return {
    id: report.publicRef,
    type: 'myReport',
    label: `Your report: ${INCIDENT_LABELS[report.reportType] ?? report.reportType} · ${toMapProgressLabel(report.status)}`,
  }
}

export function MapTab() {
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const lookupState =
    location.state && typeof location.state === 'object'
      ? (location.state as LookupNavigationState)
      : null
  const lookupReportRef =
    typeof lookupState?.selectedReportPublicRef === 'string'
      ? lookupState.selectedReportPublicRef
      : null
  const lookupMessage =
    typeof lookupState?.lookupSuccessMessage === 'string'
      ? lookupState.lookupSuccessMessage
      : LOOKUP_SUCCESS_MESSAGE
  const {
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
  } = useMapTab(mapElRef)
  const lookupMatchedReport = lookupReportRef
    ? (myReports.find((entry) => entry.publicRef === lookupReportRef) ?? null)
    : null
  const lookupSuccessMessage = lookupMatchedReport ? lookupMessage : null

  useEffect(() => {
    if (!lookupMatchedReport) return undefined
    const selectTimeout = window.setTimeout(() => {
      setSelectedPin(buildMyReportPin(lookupMatchedReport))
      setSheetPhase('expanded')
    }, 0)
    const clearStateTimeout = window.setTimeout(() => {
      void navigate('/', { replace: true, state: null })
    }, 3000)
    return () => {
      window.clearTimeout(selectTimeout)
      window.clearTimeout(clearStateTimeout)
    }
  }, [lookupMatchedReport, navigate, setSelectedPin, setSheetPhase])

  const handleIncidentTap = (incident: PublicIncident) => {
    setSelectedPin(buildIncidentPin(incident))
    setSheetPhase('peek')
  }

  const handleMyReportTap = (report: MyReport) => {
    setSelectedPin(buildMyReportPin(report))
    setSheetPhase('peek')
  }

  return (
    <div className="absolute inset-0 isolate">
      <div ref={mapElRef} className="w-full h-full" />

      {lookupSuccessMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-3 right-3 top-[4.5rem] z-[850] rounded-xl border border-success-500/20 bg-white px-4 py-3 text-sm font-semibold text-success-600 shadow-lg"
        >
          {lookupSuccessMessage}
        </div>
      ) : null}

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
            suppressedIds={new Set(myReports.flatMap((r) => (r.id ? [r.id] : [])))}
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
          Offline. Map data may be outdated
        </div>
      ) : null}

      <PeekSheet
        sheetPhase={sheetPhase}
        pin={selectedPin}
        onExpand={handleExpand}
        onDismiss={handleDismiss}
        {...(selectedPin?.type === 'myReport' &&
        selectedMyReport &&
        WITHDRAWABLE_STATUSES.has(selectedMyReport.status)
          ? { onDelete: handleDeleteRequest }
          : {})}
      />

      {sheetPhase === 'expanded' && selectedIncident ? (
        <DetailSheet
          mode="public"
          incident={selectedIncident}
          sheetPhase={sheetPhase}
          onClose={handleDismiss}
          onCollapse={handleCollapse}
          onReportSimilar={handleNavigateToReport}
        />
      ) : null}

      {sheetPhase === 'expanded' && selectedMyReport ? (
        <DetailSheet
          mode="myReport"
          report={selectedMyReport}
          sheetPhase={sheetPhase}
          onClose={handleDismiss}
          onCollapse={handleCollapse}
          onCancelReport={handleDeleteConfirm}
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
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  )
}
