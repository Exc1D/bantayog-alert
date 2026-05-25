import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { CommandHeader } from '../components/CommandHeader'
import { ProvincialMap } from '../components/ProvincialMap'
import { TriagePanel } from '../components/TriagePanel'
import { OfflineBanner } from '../components/OfflineBanner'
import { MapOverlayControls } from '../components/MapOverlayControls'
import { MunicipalDrillDown } from '../components/MunicipalDrillDown'
import { DeclareAlertModal } from '../components/DeclareAlertModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useWindowSyncContext } from '../providers/WindowSyncProvider'
import { useUrlSync } from '../hooks/useUrlSync'
import { callables } from '../services/callables'
import { db, rtdb } from '../app/firebase'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { mapReportDocToReport } from '../utils/map-report-doc'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { withRetry } from '../utils/withRetry'
import type { Report, MunicipalPerformance } from '../types'

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

function actionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}

export default function MapPage() {
  const { signOut } = useAuth()
  const {
    selectedReportId,
    selectedMunicipalityId,
    selectReport,
    selectMunicipality,
    activeOverlays,
    toggleOverlay,
    setSuppressNextBroadcast,
  } = useCommandCenterStore()

  useUrlSync({
    reportId: selectedReportId,
    municipalityId: selectedMunicipalityId,
    overlays: Array.from(activeOverlays),
    onReportIdChange: selectReport,
    onMunicipalityIdChange: selectMunicipality,
    onOverlaysChange: (overlays) => {
      const current = new Set(activeOverlays)
      const next = new Set(overlays)
      // Toggle overlays that differ
      for (const o of current) {
        if (!next.has(o)) toggleOverlay(o)
      }
      for (const o of next) {
        if (!current.has(o)) toggleOverlay(o)
      }
    },
  })

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
      activeIncidents: muniReports.filter((r) => ACTIVE_REPORT_STATUSES.includes(r.status)).length,
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
    setActionError(null)
    try {
      await withRetry(() =>
        callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() }),
      )
      setActionError(null)
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Verify failed'))
    }
  }, [])

  const handleReject = useCallback(async (id: string) => {
    try {
      await withRetry(() =>
        callables.rejectReport({
          reportId: id,
          reason: 'obviously_false',
          idempotencyKey: generateIdempotencyKey(),
        }),
      )
      setActionError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reject failed'
      setActionError(msg)
    }
  }, [])

  const handleDispatch = useCallback(
    async (reportId: string, _agency: string, responderUid: string) => {
      await Promise.resolve()
      setActionError(null)
      const report = reports.find((r) => r.id === reportId)
      if (report?.status !== 'verified') {
        setActionError('Dispatch requires a verified report')
        return
      }
      try {
        await withRetry(() =>
          callables.dispatchResponder({
            reportId,
            responderUid,
            idempotencyKey: generateIdempotencyKey(),
          }),
        )
        setActionError(null)
      } catch (err) {
        setActionError(actionErrorMessage(err, 'Dispatch failed'))
      }
    },
    [reports],
  )

  const [lastUpdatedAt] = useState(() => Date.now())
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [alertPrefill, setAlertPrefill] = useState<
    { municipalityId: string | undefined; reportId: string | undefined } | undefined
  >(undefined)

  if (loading) {
    return (
      <>
        {error && (
          <OfflineBanner
            error={error}
            onRetry={() => {
              window.location.reload()
            }}
          />
        )}
        <PageSkeleton variant="map" />
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner
        error={error}
        onRetry={() => {
          window.location.reload()
        }}
      />
      <CommandHeader
        title="Provincial Map — Camarines Norte"
        windowRole="map"
        lastUpdatedAt={lastUpdatedAt}
        onSignOut={() => {
          void signOut()
        }}
        onDeclareAlert={() => {
          setAlertPrefill(undefined)
          setAlertModalOpen(true)
        }}
      />
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
          onDeclareAlert={(reportId) => {
            setAlertPrefill({
              reportId,
              municipalityId: selectedReport?.municipality ?? undefined,
            })
            setAlertModalOpen(true)
          }}
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
        <DeclareAlertModal
          open={alertModalOpen}
          prefill={alertPrefill}
          onClose={() => {
            setAlertModalOpen(false)
            setAlertPrefill(undefined)
          }}
          onSuccess={() => {
            setAlertModalOpen(false)
            setAlertPrefill(undefined)
          }}
          onError={(msg) => {
            setActionError(msg)
          }}
        />
      </div>
    </div>
  )
}
