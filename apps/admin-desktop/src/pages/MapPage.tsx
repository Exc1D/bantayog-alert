import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { useNavigate } from 'react-router-dom'
import { CommandHeader } from '../components/CommandHeader'
import { ProvincialMap } from '../components/ProvincialMap'
import { TriagePanel } from '../components/TriagePanel'
import { OfflineBanner } from '../components/OfflineBanner'
import { MapOverlayControls } from '../components/MapOverlayControls'
import { MunicipalDrillDown } from '../components/MunicipalDrillDown'
import { DeclareAlertModal } from '../components/DeclareAlertModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { SuccessBanner } from '../components/SuccessBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { SkipLink } from '../components/SkipLink'
import { MapKeyboardNav } from '../components/MapKeyboardNav'
import { HelpModal } from '../components/HelpModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { useCommandCenterStore } from '../stores/commandCenterStore'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useWindowSyncContext } from '../providers/WindowSyncProvider'
import { useUrlSync } from '../hooks/useUrlSync'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => Date.now())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [alertPrefill, setAlertPrefill] = useState<
    { municipalityId: string | undefined; reportId: string | undefined } | undefined
  >(undefined)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [verifyConfirmOpen, setVerifyConfirmOpen] = useState(false)
  const [verifyPendingId, setVerifyPendingId] = useState<string | null>(null)

  const navigate = useNavigate()

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
    try {
      await withRetry(() =>
        callables.verifyReport({ reportId: id, idempotencyKey: generateIdempotencyKey() }),
      )
      setSuccessMessage('Report verified')
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Verify failed'))
    } finally {
      setVerifyPendingId(null)
      setVerifyConfirmOpen(false)
    }
  }, [])

  const handleRequestVerify = useCallback((id: string) => {
    setActionError(null)
    setSuccessMessage(null)
    setVerifyPendingId(id)
    setVerifyConfirmOpen(true)
  }, [])

  const handleCancelVerify = useCallback(() => {
    setVerifyPendingId(null)
    setVerifyConfirmOpen(false)
  }, [])

  const handleReject = useCallback(async (id: string) => {
    setActionError(null)
    setSuccessMessage(null)
    try {
      await withRetry(() =>
        callables.rejectReport({
          reportId: id,
          reason: 'obviously_false',
          idempotencyKey: generateIdempotencyKey(),
        }),
      )
      setSuccessMessage('Report rejected')
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
        setSuccessMessage('Responder dispatched')
      } catch (err) {
        setActionError(actionErrorMessage(err, 'Dispatch failed'))
      }
    },
    [reports],
  )

  const contentFingerprint = useMemo(
    () => reports.map((r) => `${r.id}:${r.status}:${r.updatedAt}`).join('|'),
    [reports],
  )

  // Update lastUpdatedAt whenever Firestore reports change (while not loading)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loading) {
      setLastUpdatedAt(Date.now())
    }
  }, [loading, contentFingerprint])
  /* eslint-enable react-hooks/set-state-in-effect */

  const clearSuccessMessage = useCallback(() => {
    setSuccessMessage(null)
  }, [setSuccessMessage])

  useKeyboardShortcuts([
    {
      key: 'd',
      handler: () => {
        void navigate('/dispatches')
      },
    },
    {
      key: 'f',
      handler: () => {
        void navigate('/feed')
      },
    },
    {
      key: '?',
      handler: () => {
        setHelpModalOpen(true)
      },
    },
    {
      key: 'Escape',
      handler: () => {
        setHelpModalOpen(false)
      },
    },
    {
      key: 'ArrowUp',
      handler: () => {
        if (!selectedReportId || reports.length === 0) return
        const idx = reports.findIndex((r) => r.id === selectedReportId)
        const nextIdx = idx <= 0 ? reports.length - 1 : idx - 1
        handlePinClick(reports[nextIdx]!.id)
      },
    },
    {
      key: 'ArrowDown',
      handler: () => {
        if (!selectedReportId || reports.length === 0) return
        const idx = reports.findIndex((r) => r.id === selectedReportId)
        const nextIdx = idx >= reports.length - 1 ? 0 : idx + 1
        handlePinClick(reports[nextIdx]!.id)
      },
    },
  ])

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
      <SkipLink />
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
        onShowKeyboardShortcuts={() => {
          setHelpModalOpen(true)
        }}
      />
      {successMessage && (
        <div className="absolute left-0 right-0 top-12 z-[1002] px-4">
          <SuccessBanner message={successMessage} onDismiss={clearSuccessMessage} />
        </div>
      )}
      {actionError && (
        <div className="absolute left-0 right-0 top-12 z-[1002] px-4">
          <ActionErrorBanner message={actionError} onDismiss={clearActionError} />
        </div>
      )}
      <div id="main-content" className="relative flex-1">
        <MapKeyboardNav
          reports={reports}
          selectedReportId={selectedReportId}
          onSelect={handlePinClick}
        />
        <div className="isolate h-full w-full">
          <ProvincialMap
            reports={reports}
            selectedReportId={selectedReportId}
            onPinClick={handlePinClick}
          />
        </div>
        {reports.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] px-6 py-4 text-center shadow-xl">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">No active incidents</p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Reports will appear here as they are submitted.
              </p>
            </div>
          </div>
        )}
        <MapOverlayControls
          activeOverlays={activeOverlays}
          onToggleOverlay={toggleOverlay}
          triagePanelOpen={!!selectedReport}
        />
        <TriagePanel
          report={selectedReport}
          responders={responderEntries(responders)}
          onClose={() => {
            selectReport(null)
          }}
          onVerify={handleRequestVerify}
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
            setSuccessMessage('Alert declared successfully')
          }}
          onError={(msg) => {
            setActionError(msg)
          }}
        />
        <HelpModal
          open={helpModalOpen}
          onClose={() => {
            setHelpModalOpen(false)
          }}
          shortcuts={[
            { key: '↑', description: 'Previous incident' },
            { key: '↓', description: 'Next incident' },
            { key: 'Tab', description: 'Focus the incident list' },
            { key: '?', description: 'Show keyboard shortcuts' },
            { key: 'Esc', description: 'Close help' },
          ]}
        />
        <ConfirmationModal
          open={verifyConfirmOpen}
          title="Verify Report"
          message="This will advance the report to verified status. It cannot be undone."
          confirmLabel="Verify"
          confirmVariant="primary"
          onConfirm={() => {
            if (verifyPendingId) {
              void handleVerify(verifyPendingId)
            }
          }}
          onCancel={handleCancelVerify}
        />
      </div>
    </div>
  )
}
