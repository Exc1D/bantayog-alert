import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CommandHeader } from '../components/CommandHeader'
import { OfflineBanner } from '../components/OfflineBanner'
import { SuccessBanner } from '../components/SuccessBanner'
import { PageSkeleton } from '../components/PageSkeleton'
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
import { withRetry } from '../utils/withRetry'
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
  const [verifyingReportIds, setVerifyingReportIds] = useState<Set<string>>(() => new Set())
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

  const pendingTriage = useMemo(
    () =>
      reports.filter((r) => {
        const mapped = mapReportDocToReportLoose(r)
        return mapped.status === 'new' || mapped.status === 'awaiting_verify'
      }).length,
    [reports],
  )

  const reportCommandQueue = useMemo(
    () =>
      reports
        .map((r) => mapReportDocToReportLoose(r))
        .filter(
          (r) => r.status === 'new' || r.status === 'awaiting_verify' || r.status === 'verified',
        )
        .slice(0, 6),
    [reports],
  )

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
        await withRetry(() =>
          callables.redispatchReport({
            oldDispatchId: selectedDispatchId,
            newResponderUid,
            reason: 'Re-dispatched via dashboard',
            idempotencyKey: generateIdempotencyKey(),
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
      void navigate(`/map?municipality=${encodeURIComponent(municipality)}`)
    },
    [navigate],
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

  const isStale = now - lastDataUpdateAt > 5 * 60 * 1000
  const staleMinutes = isStale ? Math.round((now - lastDataUpdateAt) / 60000) : 0

  if (isLoading && rows.length === 0 && reports.length === 0) {
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

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      {error && (
        <OfflineBanner
          error={error}
          onRetry={() => {
            window.location.reload()
          }}
        />
      )}
      <CommandHeader
        title="PDRRMO Camarines Norte"
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
        avgAcceptSeconds={opsMetrics?.avgAcceptSeconds ?? null}
        fcmSuccessRate={opsMetrics?.fcmSuccessRate ?? 0}
        pendingTriage={pendingTriage}
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
      {isStale && !error && (
        <div
          className="flex items-center justify-center gap-2 bg-[var(--color-warning)]/20 px-4 py-1.5 text-xs text-[var(--color-warning)]"
          role="status"
        >
          Data may be stale · last update {staleMinutes}m ago
        </div>
      )}
      <main className="flex-1 overflow-auto p-4">
        <h1 className="sr-only">Operations Dashboard</h1>
        {rows.length === 0 && responders.length === 0 && reports.length === 0 ? (
          <AllClearState />
        ) : (
          <div className={`space-y-4 ${mode === 'degraded' ? 'opacity-50' : ''}`}>
            {mode !== 'calm' && (
              <EscalationQueueSection
                stalledDispatches={stalledDispatches}
                onReDispatch={handleReDispatch}
                mode={mode}
              />
            )}
            {reportCommandQueue.length > 0 && (
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
                    onClick={() => {
                      void navigate('/feed')
                    }}
                  >
                    Review feed
                  </button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {reportCommandQueue.map((report) => {
                    const canAdvance =
                      report.status === 'new' || report.status === 'awaiting_verify'
                    const isNewReport = report.status === 'new'
                    const isVerifying = verifyingReportIds.has(report.id)
                    return (
                      <article
                        key={report.id}
                        className="rounded border border-white/10 bg-white/5 p-3"
                      >
                        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {report.description.trim() || 'Report details pending'}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                          {report.municipality || 'Unknown municipality'} ·{' '}
                          {report.barangay || 'Unknown barangay'}
                        </p>
                        <button
                          type="button"
                          className="mt-3 rounded bg-[var(--color-carto-blue)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={
                            canAdvance
                              ? isNewReport
                                ? `Send report ${report.id} to review`
                                : `Verify report ${report.id}`
                              : `Dispatch report ${report.id} on map`
                          }
                          disabled={canAdvance && isVerifying}
                          onClick={() => {
                            if (canAdvance) void handleVerifyReport(report.id)
                            else void navigate(`/map?reportId=${encodeURIComponent(report.id)}`)
                          }}
                        >
                          {canAdvance
                            ? isVerifying
                              ? 'Working...'
                              : isNewReport
                                ? 'Send to review'
                                : 'Verify'
                            : 'Map dispatch'}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>
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
