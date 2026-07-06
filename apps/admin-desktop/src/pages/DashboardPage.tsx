import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OfflineBanner } from '../components/OfflineBanner'
import { SuccessBanner } from '../components/SuccessBanner'
import { PageSkeleton } from '../components/PageSkeleton'
import { EscalationQueueSection } from '../components/EscalationQueueSection'
import { DispatchVolumeChart } from '../components/DispatchVolumeChart'
import { RecentEventsFeed } from '../components/RecentEventsFeed'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import { MunicipalPerformanceTable } from '../components/MunicipalPerformanceTable'
import { MunicipalHeatStrip } from '../components/MunicipalHeatStrip'
import { AllClearState } from '../components/AllClearState'
import { HelpModal } from '../components/HelpModal'
import { ReDispatchModal } from '../components/ReDispatchModal'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { StatusBar } from '../components/StatusBar'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { withRetry } from '../utils/withRetry'
import { deriveDashboardMode } from '../utils/dashboard-mode'
import type { DashboardMode } from '../utils/dashboard-mode'
import { callables } from '../services/callables'
import { useDispatchLifecycle } from '../hooks/useDispatchLifecycle'
import { useResponderFleet } from '../hooks/useResponderFleet'
import { useOpsMetrics } from '../hooks/useOpsMetrics'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useWindowSyncContext } from '../providers/WindowSyncProvider'
import { db } from '../app/firebase'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import {
  buildMunicipalData,
  getActiveDispatchCount,
  getAffectedMunicipalities,
  getUncoveredMunicipalityCount,
} from '../utils/dashboard-metrics'
import type { MunicipalPerformance, Report } from '../types'

type DispatchLifecycleRow = ReturnType<typeof useDispatchLifecycle>['rows'][number]
type ResponderFleetRow = ReturnType<typeof useResponderFleet>['responders'][number]
type DashboardReportDoc = ReturnType<typeof useFirestoreListeners>['reports'][number]
type OpsMetricsSnapshot = ReturnType<typeof useOpsMetrics>['metrics']

interface StalledDispatch {
  dispatchId: string
  escalationCount: number
  reportId: string
  responderName: string
}

interface ReportAction {
  ariaLabel: string
  canAdvance: boolean
  disabled: boolean
  label: string
}

interface ReportCommandCardProps {
  isVerifying: boolean
  onMapDispatch: (reportId: string) => void
  onVerifyReport: (reportId: string) => void
  report: Report
}

interface ReportCommandQueueSectionProps {
  onMapDispatch: (reportId: string) => void
  onReviewFeed: () => void
  onVerifyReport: (reportId: string) => void
  reports: Report[]
  verifyingReportIds: Set<string>
}

interface DashboardMainContentProps {
  mode: DashboardMode
  municipalData: MunicipalPerformance[]
  onMapDispatch: (reportId: string) => void
  onReDispatch: (dispatchId: string) => void
  onReviewFeed: () => void
  onSelectMunicipality: (municipality: string) => void
  onVerifyReport: (reportId: string) => void
  reportCommandQueue: Report[]
  reportCount: number
  responders: ResponderFleetRow[]
  rows: DispatchLifecycleRow[]
  stalledDispatches: StalledDispatch[]
  verifyingReportIds: Set<string>
}

interface DashboardFeedbackBannersProps {
  actionError: string | null
  onDismissActionError: () => void
  onDismissSuccess: () => void
  successMessage: string | null
}

interface DashboardModalsProps {
  helpModalOpen: boolean
  isDispatching: boolean
  onCloseHelp: () => void
  onCloseReDispatch: () => void
  onDispatch: (responderUid: string) => void
  previouslyNotified: string[]
  reDispatchModalOpen: boolean
  responders: ResponderFleetRow[]
}

interface DashboardStatusBarProps {
  activeCount: number
  lastDataUpdateAt: number
  metricsError: string | null
  mode: DashboardMode
  municipalData: MunicipalPerformance[]
  opsMetrics: OpsMetricsSnapshot
  pendingTriage: number
  responderCount: number
  stalledDispatchCount: number
}

const DASHBOARD_SHORTCUTS = [
  { key: 'R', description: 'Focus first Re-dispatch button' },
  { key: 'D', description: 'Navigate to Dispatch Monitor' },
  { key: 'F', description: 'Navigate to Feed' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Esc', description: 'Close help' },
]

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

function collectHookErrors(errors: (string | null | undefined)[]): string[] {
  return errors.filter((error): error is string => typeof error === 'string' && error.length > 0)
}

function isAnyDataSourceLoading(loadingStates: boolean[]): boolean {
  return loadingStates.some(Boolean)
}

function getStalledDispatches(rows: DispatchLifecycleRow[]): StalledDispatch[] {
  return rows
    .filter((row) => row.status === 'needs_admin')
    .map((row) => ({
      dispatchId: row.dispatchId,
      escalationCount: row.escalationCount,
      reportId: row.reportId,
      responderName: row.responderName,
    }))
}

function mapDashboardReports(reports: DashboardReportDoc[]): Report[] {
  return reports.map((report) => mapReportDocToReportLoose(report))
}

function countPendingTriage(reports: Report[]): number {
  return reports.filter((report) => report.status === 'new' || report.status === 'awaiting_verify')
    .length
}

function buildReportCommandQueue(reports: Report[]): Report[] {
  return reports
    .filter(
      (report) =>
        report.status === 'new' ||
        report.status === 'awaiting_verify' ||
        report.status === 'verified',
    )
    .slice(0, 6)
}

function getModeFcmSuccessRate(opsMetrics: OpsMetricsSnapshot): number {
  return opsMetrics?.fcmSuccessRate ?? 1.0
}

function getStatusFcmSuccessRate(opsMetrics: OpsMetricsSnapshot): number | null {
  return opsMetrics?.fcmSuccessRate ?? null
}

function getAvgAcceptSeconds(opsMetrics: OpsMetricsSnapshot): number | null {
  return opsMetrics?.avgAcceptSeconds ?? null
}

function getAvgResponseMinutes(opsMetrics: OpsMetricsSnapshot): number {
  const seconds = getAvgAcceptSeconds(opsMetrics)
  return seconds ? Math.round(seconds / 60) : 0
}

function getPreviouslyNotified(
  rows: DispatchLifecycleRow[],
  selectedDispatchId: string | null,
): string[] {
  if (!selectedDispatchId) return []
  return (
    rows.find((row) => row.dispatchId === selectedDispatchId)?.previouslyNotifiedResponderUids ?? []
  )
}

function getReportAction(report: Report, isVerifying: boolean): ReportAction {
  if (report.status === 'verified') {
    return {
      ariaLabel: `Dispatch report ${report.id} on map`,
      canAdvance: false,
      disabled: false,
      label: 'Map dispatch',
    }
  }

  const isNewReport = report.status === 'new'
  return {
    ariaLabel: isNewReport ? `Send report ${report.id} to review` : `Verify report ${report.id}`,
    canAdvance: true,
    disabled: isVerifying,
    label: isVerifying ? 'Working...' : isNewReport ? 'Send to review' : 'Verify',
  }
}

function isInitialDashboardLoading(
  isLoading: boolean,
  rows: DispatchLifecycleRow[],
  reports: DashboardReportDoc[],
): boolean {
  return isLoading && rows.length === 0 && reports.length === 0
}

function hasAnyDataSourceLoaded(loadingStates: boolean[]): boolean {
  return loadingStates.some((loading) => !loading)
}

function getStaleDataState(now: number, lastDataUpdateAt: number) {
  const staleAgeMs = now - lastDataUpdateAt
  const isStale = staleAgeMs > 5 * 60 * 1000
  return {
    isStale,
    staleMinutes: isStale ? Math.round(staleAgeMs / 60000) : 0,
  }
}

function DashboardLoadingState({ error }: { error: string | null }) {
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
      <PageSkeleton variant="dashboard" />
    </>
  )
}

function StaleDataBanner({ staleMinutes }: { staleMinutes: number }) {
  return (
    <div
      className="flex items-center justify-center gap-2 bg-[var(--color-warning)]/20 px-4 py-1.5 text-xs text-[var(--color-warning)]"
      role="status"
    >
      Data may be stale · last update {staleMinutes}m ago
    </div>
  )
}

function DashboardOfflineBanner({ error }: { error: string | null }) {
  if (!error) return null

  return (
    <OfflineBanner
      error={error}
      onRetry={() => {
        window.location.reload()
      }}
    />
  )
}

function DashboardFeedbackBanners({
  actionError,
  onDismissActionError,
  onDismissSuccess,
  successMessage,
}: DashboardFeedbackBannersProps) {
  return (
    <>
      {successMessage && <SuccessBanner message={successMessage} onDismiss={onDismissSuccess} />}
      {actionError && <ActionErrorBanner message={actionError} onDismiss={onDismissActionError} />}
    </>
  )
}

function DashboardStaleDataBanner({
  error,
  isStale,
  staleMinutes,
}: {
  error: string | null
  isStale: boolean
  staleMinutes: number
}) {
  if (error || !isStale) return null
  return <StaleDataBanner staleMinutes={staleMinutes} />
}

function DashboardStatusBar({
  activeCount,
  lastDataUpdateAt,
  metricsError,
  mode,
  municipalData,
  opsMetrics,
  pendingTriage,
  responderCount,
  stalledDispatchCount,
}: DashboardStatusBarProps) {
  return (
    <StatusBar
      activeIncidents={activeCount}
      avgResponseTime={getAvgResponseMinutes(opsMetrics)}
      avgAcceptSeconds={getAvgAcceptSeconds(opsMetrics)}
      fcmSuccessRate={getStatusFcmSuccessRate(opsMetrics)}
      pendingTriage={pendingTriage}
      mode={mode}
      affectedMunicipalities={getAffectedMunicipalities(municipalData)}
      stalledDispatchCount={stalledDispatchCount}
      totalResponders={responderCount}
      uncoveredMunicipalities={getUncoveredMunicipalityCount(municipalData)}
      lastDataUpdateAt={lastDataUpdateAt}
      {...(metricsError != null ? { metricsError } : {})}
    />
  )
}

function ReportCommandCard({
  isVerifying,
  onMapDispatch,
  onVerifyReport,
  report,
}: ReportCommandCardProps) {
  const action = getReportAction(report, isVerifying)

  return (
    <article className="rounded border border-white/10 bg-white/5 p-3">
      <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
        {report.description.trim() || 'Report details pending'}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
        {report.municipality || 'Unknown municipality'} · {report.barangay || 'Unknown barangay'}
      </p>
      <button
        type="button"
        className="mt-3 rounded bg-[var(--color-carto-blue)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={action.ariaLabel}
        disabled={action.disabled}
        onClick={() => {
          if (action.canAdvance) onVerifyReport(report.id)
          else onMapDispatch(report.id)
        }}
      >
        {action.label}
      </button>
    </article>
  )
}

function ReportCommandQueueSection({
  onMapDispatch,
  onReviewFeed,
  onVerifyReport,
  reports,
  verifyingReportIds,
}: ReportCommandQueueSectionProps) {
  if (reports.length === 0) return null

  return (
    <section
      aria-labelledby="report-command-queue-title"
      className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="report-command-queue-title"
            className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-primary)]"
          >
            Report command queue
          </h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Send new reports to review. Verify reviewed reports for Map dispatch.
          </p>
        </div>
        <button
          type="button"
          className="rounded border border-white/10 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-white/5"
          onClick={onReviewFeed}
        >
          Review feed
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <ReportCommandCard
            key={report.id}
            isVerifying={verifyingReportIds.has(report.id)}
            onMapDispatch={onMapDispatch}
            onVerifyReport={onVerifyReport}
            report={report}
          />
        ))}
      </div>
    </section>
  )
}

function DashboardMainContent({
  mode,
  municipalData,
  onMapDispatch,
  onReDispatch,
  onReviewFeed,
  onSelectMunicipality,
  onVerifyReport,
  reportCommandQueue,
  reportCount,
  responders,
  rows,
  stalledDispatches,
  verifyingReportIds,
}: DashboardMainContentProps) {
  const showAllClear = rows.length === 0 && responders.length === 0 && reportCount === 0

  return (
    <main className="flex-1 overflow-auto p-4">
      <h1 className="sr-only">Operations Dashboard</h1>
      {showAllClear ? (
        <AllClearState />
      ) : (
        <div className={`space-y-4 ${mode === 'degraded' ? 'opacity-50' : ''}`}>
          <MunicipalHeatStrip data={municipalData} onSelect={onSelectMunicipality} />
          {mode !== 'calm' && (
            <EscalationQueueSection
              stalledDispatches={stalledDispatches}
              onReDispatch={onReDispatch}
              mode={mode}
            />
          )}
          <ReportCommandQueueSection
            reports={reportCommandQueue}
            verifyingReportIds={verifyingReportIds}
            onVerifyReport={onVerifyReport}
            onReviewFeed={onReviewFeed}
            onMapDispatch={onMapDispatch}
          />
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
                  onSelectMunicipality={onSelectMunicipality}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function DashboardModals({
  helpModalOpen,
  isDispatching,
  onCloseHelp,
  onCloseReDispatch,
  onDispatch,
  previouslyNotified,
  reDispatchModalOpen,
  responders,
}: DashboardModalsProps) {
  return (
    <>
      <HelpModal open={helpModalOpen} onClose={onCloseHelp} shortcuts={DASHBOARD_SHORTCUTS} />
      <ReDispatchModal
        isOpen={reDispatchModalOpen}
        onClose={onCloseReDispatch}
        onDispatch={onDispatch}
        responders={responders}
        previouslyNotified={previouslyNotified}
        isLoading={isDispatching}
      />
    </>
  )
}

export default function DashboardPage() {
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
  const [reDispatchModalOpen, setReDispatchModalOpen] = useState(false)
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isDispatching, setIsDispatching] = useState(false)
  const [verifyingReportIds, setVerifyingReportIds] = useState<Set<string>>(() => new Set())
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())

  const stalledDispatches = useMemo(() => getStalledDispatches(rows), [rows])
  const activeCount = useMemo(() => getActiveDispatchCount(rows), [rows])
  const mappedReports = useMemo(() => mapDashboardReports(reports), [reports])
  const hookErrors = useMemo(
    () => collectHookErrors([lifecycleError, fleetError, metricsError, reportsError]),
    [fleetError, lifecycleError, metricsError, reportsError],
  )

  const mode: DashboardMode = computeDashboardMode(
    stalledDispatches.length,
    activeCount,
    getModeFcmSuccessRate(opsMetrics),
    hookErrors,
    lastDataUpdateAt,
  )

  useEffect(() => {
    if (hasAnyDataSourceLoaded([lifecycleLoading, fleetLoading, metricsLoading, reportsLoading])) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastDataUpdateAt(Date.now())
    }
  }, [lifecycleLoading, fleetLoading, metricsLoading, reportsLoading])

  const isLoading = isAnyDataSourceLoading([
    lifecycleLoading,
    fleetLoading,
    metricsLoading,
    reportsLoading,
  ])
  const error = hookErrors[0] ?? null
  const municipalData = useMemo(
    () => buildMunicipalData(mappedReports, responders),
    [mappedReports, responders],
  )
  const pendingTriage = useMemo(() => countPendingTriage(mappedReports), [mappedReports])
  const reportCommandQueue = useMemo(() => buildReportCommandQueue(mappedReports), [mappedReports])
  const previouslyNotified = useMemo(
    () => getPreviouslyNotified(rows, selectedDispatchId),
    [rows, selectedDispatchId],
  )

  const navigate = useNavigate()
  const { sendSync } = useWindowSyncContext()

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
        const idempotencyKey = generateIdempotencyKey()
        await withRetry(() =>
          callables.redispatchReport({
            oldDispatchId: selectedDispatchId,
            newResponderUid,
            reason: 'Re-dispatched via dashboard',
            idempotencyKey,
          }),
        )
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
      void navigate(`/map?municipalityId=${encodeURIComponent(municipality)}`)
      sendSync({ type: 'select:municipality', municipalityId: municipality, source: 'dashboard' })
    },
    [navigate, sendSync],
  )

  const handleVerifyReport = useCallback(async (reportId: string) => {
    setVerifyingReportIds((prev) => new Set(prev).add(reportId))
    setActionError(null)
    const idempotencyKey = generateIdempotencyKey()
    try {
      const result = await withRetry(() => callables.verifyReport({ reportId, idempotencyKey }))
      setSuccessMessage(result.status === 'verified' ? 'Report verified' : 'Report sent to review')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Report verification failed')
      setSuccessMessage(null)
    } finally {
      setVerifyingReportIds((prev) => {
        const next = new Set(prev)
        next.delete(reportId)
        return next
      })
    }
  }, [])

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

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 60000)
    return () => {
      clearInterval(id)
    }
  }, [])

  const staleData = getStaleDataState(now, lastDataUpdateAt)

  if (isInitialDashboardLoading(isLoading, rows, reports)) {
    return <DashboardLoadingState error={error} />
  }

  return (
    <>
      <DashboardOfflineBanner error={error} />
      <DashboardFeedbackBanners
        actionError={actionError}
        onDismissActionError={() => {
          setActionError(null)
        }}
        onDismissSuccess={() => {
          setSuccessMessage(null)
        }}
        successMessage={successMessage}
      />
      <DashboardStatusBar
        activeCount={activeCount}
        lastDataUpdateAt={lastDataUpdateAt}
        metricsError={metricsError}
        mode={mode}
        municipalData={municipalData}
        opsMetrics={opsMetrics}
        pendingTriage={pendingTriage}
        responderCount={responders.length}
        stalledDispatchCount={stalledDispatches.length}
      />
      <DashboardStaleDataBanner
        error={error}
        isStale={staleData.isStale}
        staleMinutes={staleData.staleMinutes}
      />
      <DashboardMainContent
        mode={mode}
        municipalData={municipalData}
        onMapDispatch={(reportId) => {
          void navigate(`/map?reportId=${encodeURIComponent(reportId)}`)
        }}
        onReDispatch={handleReDispatch}
        onReviewFeed={() => {
          void navigate('/feed')
        }}
        onSelectMunicipality={handleSelectMunicipality}
        onVerifyReport={(reportId) => {
          void handleVerifyReport(reportId)
        }}
        reportCommandQueue={reportCommandQueue}
        reportCount={reports.length}
        responders={responders}
        rows={rows}
        stalledDispatches={stalledDispatches}
        verifyingReportIds={verifyingReportIds}
      />
      <DashboardModals
        helpModalOpen={helpModalOpen}
        isDispatching={isDispatching}
        onCloseHelp={() => {
          setHelpModalOpen(false)
        }}
        onCloseReDispatch={() => {
          setReDispatchModalOpen(false)
          setSelectedDispatchId(null)
        }}
        onDispatch={(uid) => {
          void handleConfirmReDispatch(uid)
        }}
        previouslyNotified={previouslyNotified}
        responders={responders}
        reDispatchModalOpen={reDispatchModalOpen}
      />
    </>
  )
}
