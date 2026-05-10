import { useCallback, useEffect, useMemo, useState } from 'react'
import { CommandHeader } from '../components/CommandHeader'
import { ProvincialMap } from '../components/ProvincialMap'
import { TriagePanel } from '../components/TriagePanel'
import { OfflineBanner } from '../components/OfflineBanner'
import { MapOverlayControls } from '../components/MapOverlayControls'
import { MunicipalDrillDown } from '../components/MunicipalDrillDown'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useWindowSyncContext } from '../providers/WindowSyncProvider'
import { callables } from '../services/callables'
import { db, rtdb } from '../app/firebase'
import type { Report, MunicipalPerformance } from '../types'

function generateIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${String(Date.now())}-${Math.random().toString(36).slice(2)}`
  }
}

function responderEntries(responders: [string, unknown][]): {
  uid: string
  displayName?: string
  agency?: string
}[] {
  return responders
    .map(([uid, data]) => {
      const d = data as Record<string, unknown> | undefined
      const entry: { uid: string; displayName?: string; agency?: string } = { uid }
      if (typeof d?.displayName === 'string') entry.displayName = d.displayName
      if (typeof d?.agency === 'string') entry.agency = d.agency
      return entry
    })
    .filter((r) => r.uid)
}

function mapReportDocToReport(
  doc: {
    id: string
    type: string
    severity: string
    municipality: string
    barangay: string
    createdAt: string
    status: string
    description: string
  } & Record<string, unknown>,
): Report | null {
  const latitude =
    typeof doc.latitude === 'number'
      ? doc.latitude
      : typeof doc.location === 'object' && doc.location !== null
        ? (doc.location as Record<string, unknown>).latitude
        : undefined
  const longitude =
    typeof doc.longitude === 'number'
      ? doc.longitude
      : typeof doc.location === 'object' && doc.location !== null
        ? (doc.location as Record<string, unknown>).longitude
        : undefined

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null
  }

  return {
    id: doc.id,
    type: doc.type as Report['type'],
    severity: doc.severity as Report['severity'],
    municipality: doc.municipality,
    barangay: doc.barangay,
    createdAt: doc.createdAt,
    status: doc.status as Report['status'],
    description: doc.description,
    reporterName: '',
    reporterPhone: '',
    latitude,
    longitude,
    updatedAt: '',
  }
}

export default function MapPage() {
  const {
    selectedReportId,
    selectedMunicipalityId,
    selectReport,
    selectMunicipality,
    activeOverlays,
    toggleOverlay,
    setSuppressNextBroadcast,
  } = useCommandCenterStore()

  const {
    loading,
    error,
    reports: reportDocs,
    responders,
  } = useFirestoreListeners({
    windowType: 'map',
    db,
    rtdb,
  })

  const { sendSync, subscribe } = useWindowSyncContext()

  const reports = (reportDocs as ((typeof reportDocs)[number] & Record<string, unknown>)[])
    .map(mapReportDocToReport)
    .filter((r): r is Report => r !== null)
  const selectedReport = reports.find((r) => r.id === selectedReportId) ?? null
  const [actionError, setActionError] = useState<string | null>(null)

  const municipalityData: MunicipalPerformance | null = useMemo(() => {
    if (!selectedMunicipalityId) return null
    const muniReports = reports.filter((r) => r.municipality === selectedMunicipalityId)
    return {
      municipality: selectedMunicipalityId,
      activeIncidents: muniReports.filter((r) => r.status === 'ACTIVE').length,
      activeResponders: 0,
      avgResponseTime: '0m',
      unresolvedOver24h: 0,
      adminOnDuty: false,
    }
  }, [selectedMunicipalityId, reports])

  // Cross-window sync: receive from dashboard
  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type === 'select:report' && msg.source === 'dashboard') {
        selectReport(msg.reportId)
      }
      if (msg.type === 'select:municipality' && msg.source === 'dashboard') {
        // Municipality selection on map centers the map;
        // drill-down data not yet available without a lookup helper
      }
    })
  }, [subscribe, selectReport])

  const handlePinClick = useCallback(
    (reportId: string) => {
      selectReport(reportId)
      setSuppressNextBroadcast(true)
      sendSync({ type: 'select:report', reportId, source: 'map' })
    },
    [selectReport, sendSync, setSuppressNextBroadcast],
  )

  const clearActionError = useCallback(() => {
    setActionError(null)
  }, [])

  const handleVerify = useCallback(async (id: string) => {
    try {
      await callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() })
      setActionError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Verify failed'
      setActionError(msg)
    }
  }, [])

  const handleReject = useCallback(async (id: string) => {
    try {
      await callables.rejectReport({
        reportId: id,
        reason: 'obviously_false',
        idempotencyKey: generateIdempotencyKey(),
      })
      setActionError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reject failed'
      setActionError(msg)
    }
  }, [])

  const handleDispatch = useCallback(
    async (reportId: string, _agency: string, responderUid: string) => {
      try {
        await callables.dispatchResponder({
          reportId,
          responderUid,
          idempotencyKey: generateIdempotencyKey(),
        })
        setActionError(null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Dispatch failed'
        setActionError(msg)
      }
    },
    [],
  )

  const [lastUpdatedAt] = useState(() => Date.now())

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-[var(--color-surface)]">
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner error={error} />
      <CommandHeader title="Provincial Map — Camarines Norte" lastUpdatedAt={lastUpdatedAt} />
      {actionError && (
        <div
          className="absolute left-0 right-0 top-12 z-[60] border border-[var(--color-danger)] bg-[var(--color-danger)]/20 px-4 py-2 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {actionError}
          <button onClick={clearActionError} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
      <div className="relative flex-1">
        <div className="isolate h-full w-full">
          <ProvincialMap
            reports={reports}
            selectedReportId={selectedReportId}
            onPinClick={handlePinClick}
          />
        </div>
        <MapOverlayControls activeOverlays={activeOverlays} onToggleOverlay={toggleOverlay} />
        <TriagePanel
          report={selectedReport}
          responders={responderEntries(responders)}
          onClose={() => {
            selectReport(null)
          }}
          onVerify={(id) => void handleVerify(id)}
          onReject={(id) => void handleReject(id)}
          onDispatch={(reportId, agency, responderUid) =>
            void handleDispatch(reportId, agency, responderUid)
          }
        />
        {municipalityData && (
          <div className="absolute bottom-4 left-4 z-20 max-w-xs">
            <MunicipalDrillDown
              data={municipalityData}
              onClose={() => {
                selectMunicipality(null)
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
