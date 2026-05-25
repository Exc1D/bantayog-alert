import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommandHeader } from '../components/CommandHeader'
import { OfflineBanner } from '../components/OfflineBanner'
import { SuccessBanner } from '../components/SuccessBanner'
import { DispatchStatsCards } from '../components/DispatchStatsCards'
import { EscalationQueueSection } from '../components/EscalationQueueSection'
import { DispatchVolumeChart } from '../components/DispatchVolumeChart'
import { RecentEventsFeed } from '../components/RecentEventsFeed'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'
import { AllClearState } from '../components/AllClearState'
import { HelpModal } from '../components/HelpModal'
import { DeclareAlertModal } from '../components/DeclareAlertModal'
import { ReDispatchModal } from '../components/ReDispatchModal'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { StatusBar } from '../components/StatusBar'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { deriveDashboardMode } from '../utils/dashboard-mode'
import type { DashboardMode } from '../utils/dashboard-mode'
import { callables } from '../services/callables'
import { useAuth } from '@bantayog/shared-ui'
import { useDispatchLifecycle } from '../hooks/useDispatchLifecycle'
import { useResponderFleet } from '../hooks/useResponderFleet'
import { useOpsMetrics } from '../hooks/useOpsMetrics'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { db } from '../app/firebase'
import { ACTIVE_REPORT_STATUSES } from '@bantayog/shared-types'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import type { MunicipalPerformance, Report } from '../types'

function computeDashboardMode(
  stalledCount: number,
  activeCount: number,
  fcmRate: number,
  hookErrors: string[],
  lastDataUpdateAt: number,
): DashboardMode {
  const dataFreshness = Date.now() - lastDataUpdateAt
  return deriveDashboardMode(stalledCount, activeCount, fcmRate, hookErrors, dataFreshness)
}

export default function DashboardPage() {
  const { signOut } = useAuth()
  const { rows, loading: lifecycleLoading, error: lifecycleError } = useDispatchLifecycle(db)
  const { responders, loading: fleetLoading, error: fleetError } = useResponderFleet(db)
  const { metrics: opsMetrics, loading: metricsLoading, error: metricsError } = useOpsMetrics('24h')
  const {
    reports,
    loading: reportsLoading,
    error: reportsError,
  } = useFirestoreListeners({
    windowType: 'dashboard',
    db,
  })

  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [reDispatchModalOpen, setReDispatchModalOpen] = useState(false)
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isDispatching, setIsDispatching] = useState(false)
  const [pageLoadedAt] = useState(() => Date.now())
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())

  const stalledDispatches = rows
    .filter((r) => r.status === 'needs_admin')
    .map((r) => ({
      dispatchId: r.dispatchId,
      reportId: r.reportId,
      responderName: r.responderName,
      escalationCount: r.escalationCount,
    }))

  const activeCount = rows.filter((r) => r.status !== 'needs_admin').length

  const hookErrors: string[] = []
  if (lifecycleError) hookErrors.push(lifecycleError)
  if (fleetError) hookErrors.push(fleetError)
  if (metricsError) hookErrors.push(metricsError)
  if (reportsError) hookErrors.push(reportsError)

  const mode: DashboardMode = computeDashboardMode(
    stalledDispatches.length,
    activeCount,
    opsMetrics?.fcmSuccessRate ?? 1.0,
    hookErrors,
    lastDataUpdateAt,
  )

  useEffect(() => {
    if (!lifecycleLoading || !fleetLoading || !metricsLoading || !reportsLoading) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastDataUpdateAt(Date.now())
    }
  }, [lifecycleLoading, fleetLoading, metricsLoading, reportsLoading])

  const isLoading = lifecycleLoading || fleetLoading || metricsLoading || reportsLoading
  const error = lifecycleError ?? fleetError ?? metricsError ?? reportsError

  const municipalData: MunicipalPerformance[] = useMemo(() => {
    const byMuni = new Map<string, Report[]>()
    reports.forEach((r) => {
      const mapped = mapReportDocToReportLoose(r)
      const key = mapped.municipality || 'Unknown'
      const list = byMuni.get(key) ?? []
      list.push(mapped)
      byMuni.set(key, list)
    })
    return Array.from(byMuni.entries()).map(([municipality, muniReports]) => ({
      municipality,
      activeIncidents: muniReports.filter((r) => ACTIVE_REPORT_STATUSES.includes(r.status)).length,
    }))
  }, [reports])

  const navigate = useNavigate()

  const handleReDispatch = useCallback((dispatchId: string) => {
    setSelectedDispatchId(dispatchId)
    setReDispatchModalOpen(true)
  }, [])

  const handleConfirmReDispatch = useCallback(
    async (newResponderUid: string) => {
      if (!selectedDispatchId) return
      setIsDispatching(true)
      setActionError(null)
      try {
        await callables.redispatchReport({
          oldDispatchId: selectedDispatchId,
          newResponderUid,
          reason: 'Re-dispatched via dashboard',
          idempotencyKey: generateIdempotencyKey(),
        })
        setSuccessMessage('Re-dispatched successfully')
        setActionError(null)
        setReDispatchModalOpen(false)
        setSelectedDispatchId(null)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Re-dispatch failed')
        setSuccessMessage(null)
      } finally {
        setIsDispatching(false)
      }
    },
    [selectedDispatchId],
  )

  const handleSelectMunicipality = useCallback(
    (municipality: string) => {
      void navigate(`/map?municipality=${encodeURIComponent(municipality)}`)
    },
    [navigate],
  )

  useKeyboardShortcuts([
    {
      key: 'r',
      handler: () => {
        const first = document.querySelector<HTMLElement>('[aria-label^="Re-dispatch"]')
        first?.focus()
      },
    },
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
  ])

  if (isLoading && rows.length === 0 && reports.length === 0) {
    return (
      <div className="flex h-screen flex-col bg-[var(--color-surface)]">
        <CommandHeader title="PDRRMO Camarines Norte" lastUpdatedAt={pageLoadedAt} />
        {error && <OfflineBanner error={error} />}
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <CommandHeader
        title="PDRRMO Camarines Norte"
        lastUpdatedAt={pageLoadedAt}
        windowRole="dashboard"
        onDeclareAlert={() => {
          setAlertModalOpen(true)
        }}
        onShowKeyboardShortcuts={() => {
          setHelpModalOpen(true)
        }}
        onSignOut={() => {
          void signOut()
        }}
      />
      {error && <OfflineBanner error={error} />}
      {successMessage && (
        <SuccessBanner
          message={successMessage}
          onDismiss={() => {
            setSuccessMessage(null)
          }}
        />
      )}
      {actionError && (
        <ActionErrorBanner
          message={actionError}
          onDismiss={() => {
            setActionError(null)
          }}
        />
      )}
      <StatusBar
        activeIncidents={activeCount}
        avgResponseTime={
          opsMetrics?.avgAcceptSeconds ? Math.round(opsMetrics.avgAcceptSeconds / 60) : 0
        }
        pendingTriage={0} // TODO: derive from reports
        mode={mode}
        affectedMunicipalities={municipalData
          .filter((m) => m.activeIncidents > 0)
          .map((m) => m.municipality)}
        stalledDispatchCount={stalledDispatches.length}
        totalResponders={responders.length}
        uncoveredMunicipalities={
          municipalData.filter((m) => (m.activeResponders ?? 0) === 0).length
        }
        lastDataUpdateAt={lastDataUpdateAt}
      />
      <main className="flex-1 overflow-auto p-4">
        <h1 className="sr-only">Operations Dashboard</h1>
        {rows.length === 0 && responders.length === 0 && reports.length === 0 ? (
          <AllClearState />
        ) : (
          <div className={`space-y-4 ${mode === 'degraded' ? 'opacity-50' : ''}`}>
            <DispatchStatsCards
              activeCount={activeCount}
              stalledCount={stalledDispatches.length}
              avgAcceptSeconds={opsMetrics?.avgAcceptSeconds ?? null}
              fcmSuccessRate={opsMetrics?.fcmSuccessRate ?? 0}
              mode={mode}
            />
            {mode !== 'calm' && (
              <EscalationQueueSection
                stalledDispatches={stalledDispatches}
                onReDispatch={handleReDispatch}
                mode={mode}
              />
            )}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
              <div className="space-y-4">
                {mode !== 'surge' && <DispatchVolumeChart rows={rows} />}
                <RecentEventsFeed rows={rows} />
              </div>
              <div className="space-y-4">
                <ResponderAvailabilityPanel responders={responders} />
                {mode !== 'surge' && (
                  <MunicipalPerformanceTable
                    data={municipalData}
                    onSelectMunicipality={handleSelectMunicipality}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <HelpModal
        open={helpModalOpen}
        onClose={() => {
          setHelpModalOpen(false)
        }}
        shortcuts={[
          { key: 'R', description: 'Focus first Re-dispatch button' },
          { key: 'D', description: 'Navigate to Dispatch Monitor' },
          { key: 'F', description: 'Navigate to Feed' },
          { key: '?', description: 'Show keyboard shortcuts' },
          { key: 'Esc', description: 'Close help' },
        ]}
      />
      <DeclareAlertModal
        open={alertModalOpen}
        onClose={() => {
          setAlertModalOpen(false)
        }}
        onSuccess={() => {
          setAlertModalOpen(false)
        }}
        onError={(msg) => {
          console.error('Alert declaration failed:', msg)
        }}
      />
      <ReDispatchModal
        isOpen={reDispatchModalOpen}
        onClose={() => {
          setReDispatchModalOpen(false)
          setSelectedDispatchId(null)
        }}
        onDispatch={(uid) => {
          void handleConfirmReDispatch(uid)
        }}
        responders={responders}
        previouslyNotified={
          selectedDispatchId
            ? (rows.find((r) => r.dispatchId === selectedDispatchId)
                ?.previouslyNotifiedResponderUids ?? [])
            : []
        }
        isLoading={isDispatching}
      />
    </div>
  )
}
