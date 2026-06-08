import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getFirestoreInstance } from '../app/firebase'
import { useDispatchLifecycle } from '../hooks/useDispatchLifecycle'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useResponderFleet } from '../hooks/useResponderFleet'
import { useOpsMetrics } from '../hooks/useOpsMetrics'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useAuth } from '@bantayog/shared-ui'
import { CommandHeader } from '../components/CommandHeader'
import { DispatchStatsCards } from '../components/DispatchStatsCards'
import { EscalationQueueSection } from '../components/EscalationQueueSection'
import { DispatchLifecycleTable } from '../components/DispatchLifecycleTable'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import { ReDispatchModal } from '../components/ReDispatchModal'
import { OfflineBanner } from '../components/OfflineBanner'
import { SuccessBanner } from '../components/SuccessBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { PageSkeleton } from '../components/PageSkeleton'
import { HelpModal } from '../components/HelpModal'
import { DeclareAlertModal } from '../components/DeclareAlertModal'
import { callables } from '../services/callables'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { withRetry } from '../utils/withRetry'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import type { Report } from '../types'

interface AssignmentReport {
  report: Report
  municipalityId?: string
}

const FIELD_PROGRESS_STATUSES = new Set(['accepted', 'acknowledged', 'en_route', 'on_scene'])

function responderStatusLabel(status: string): string {
  if (status === 'accepted') return 'Accepted'
  if (status === 'acknowledged') return 'Acknowledged'
  if (status === 'en_route') return 'En route'
  if (status === 'on_scene') return 'On scene'
  return status.replace(/_/g, ' ')
}

export function DispatchMonitorPage() {
  const db = getFirestoreInstance()
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const { rows, loading, error } = useDispatchLifecycle(db)
  const { responders } = useResponderFleet(db)
  const { reports: assignmentReportDocs, error: assignmentError } = useFirestoreListeners({
    windowType: 'dashboard',
    db,
  })
  const { metrics: opsMetrics } = useOpsMetrics('24h')

  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, string>>({})
  const [assigningReportId, setAssigningReportId] = useState<string | null>(null)
  const [creatingResponder, setCreatingResponder] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  const highlightDispatchId = searchParams.get('highlight')

  const stalledDispatches = rows.filter((r) => r.status === 'needs_admin')
  const responderStatusRows = rows.filter((r) => FIELD_PROGRESS_STATUSES.has(r.status))
  const activeCount = rows.filter((r) => r.status !== 'needs_admin').length
  const avgAcceptSeconds = opsMetrics?.avgAcceptSeconds ?? null
  const fcmSuccessRate = opsMetrics?.fcmSuccessRate ?? 0
  const pageError = error ?? assignmentError
  const assignmentReports: AssignmentReport[] = assignmentReportDocs
    .map((doc) => {
      const report = mapReportDocToReportLoose(doc)
      const municipalityId = typeof doc.municipalityId === 'string' ? doc.municipalityId : undefined
      return {
        report,
        ...(municipalityId ? { municipalityId } : {}),
      }
    })
    .filter((item) => item.report.status === 'verified')

  const selectedRow = rows.find((r) => r.dispatchId === selectedDispatchId)
  const previouslyNotified = selectedRow?.previouslyNotifiedResponderUids ?? []

  const dispatchSnapshotKey = useMemo(
    () =>
      rows
        .map((row) =>
          [
            row.dispatchId,
            row.reportId,
            row.status,
            row.responderName,
            row.responderAgency,
            row.dispatchedAt,
            row.deadlineAt,
            row.escalationCount,
            row.fcmResult ?? '',
            row.timeline[0]?.at ?? '',
          ].join(':'),
        )
        .join('|'),
    [rows],
  )

  const responderSnapshotKey = useMemo(
    () =>
      responders
        .map((responder) =>
          [
            responder.uid,
            responder.availabilityStatus,
            responder.displayName,
            responder.municipalityId ?? '',
            responder.lastActivityAt,
          ].join(':'),
        )
        .join('|'),
    [responders],
  )

  // Track data freshness
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loading) {
      setLastDataUpdateAt(Date.now())
    }
  }, [dispatchSnapshotKey, loading, responderSnapshotKey])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Clock for stale indicator
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

  const handleReDispatch = (dispatchId: string) => {
    setSelectedDispatchId(dispatchId)
    setIsModalOpen(true)
    setDispatchError(null)
  }

  const handleCloseModal = () => {
    setSelectedDispatchId(null)
    setIsModalOpen(false)
    setDispatchError(null)
  }

  const handleDispatch = async (responderUid: string, forceOverride?: true) => {
    if (!selectedDispatchId) return
    setIsDispatching(true)
    setDispatchError(null)
    try {
      await withRetry(() =>
        callables.escalateDispatch({
          dispatchId: selectedDispatchId,
          newResponderUid: responderUid,
          idempotencyKey: generateIdempotencyKey(),
          ...(forceOverride ? { forceOverride } : {}),
        }),
      )
      setSuccessMessage('Re-dispatched successfully')
      setIsModalOpen(false)
      setSelectedDispatchId(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDispatchError(message)
    } finally {
      setIsDispatching(false)
    }
  }

  const handleCreateResponder = async (input: {
    displayName: string
    phone: string
    agencyId: string
    municipalityId?: string
    specializations?: string[]
  }) => {
    setCreatingResponder(true)
    setDispatchError(null)
    const idempotencyKey = generateIdempotencyKey()
    try {
      await withRetry(() =>
        callables.createResponder({
          ...input,
          idempotencyKey,
        }),
      )
      setSuccessMessage('Responder account created')
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Responder account creation failed')
    } finally {
      setCreatingResponder(false)
    }
  }

  const candidateRespondersFor = (assignment: AssignmentReport) => {
    if (!assignment.municipalityId) return responders
    const scoped = responders.filter((r) => r.municipalityId === assignment.municipalityId)
    return scoped.length > 0 ? scoped : responders
  }

  const handleAssignResponder = async (reportId: string) => {
    const responderUid = assignmentSelections[reportId]
    if (!responderUid) {
      setDispatchError('Choose a responder before assigning')
      return
    }

    setAssigningReportId(reportId)
    setDispatchError(null)
    try {
      await withRetry(() =>
        callables.dispatchResponder({
          reportId,
          responderUid,
          idempotencyKey: generateIdempotencyKey(),
        }),
      )
      setSuccessMessage('Responder assigned')
      setAssignmentSelections((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== reportId)),
      )
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Responder assignment failed')
    } finally {
      setAssigningReportId(null)
    }
  }

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

  if (loading && rows.length === 0) {
    return (
      <>
        {pageError && (
          <OfflineBanner
            error={pageError}
            onRetry={() => {
              window.location.reload()
            }}
          />
        )}
        <PageSkeleton variant="dispatch" />
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <a
        href="#main-content"
        className="sr-only rounded bg-blue-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        Skip to main content
      </a>

      {pageError && (
        <OfflineBanner
          error={pageError}
          onRetry={() => {
            window.location.reload()
          }}
        />
      )}
      <CommandHeader
        title="PDRRMO Camarines Norte"
        windowRole="dispatches"
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
      {dispatchError && (
        <ActionErrorBanner
          message={dispatchError}
          onDismiss={() => {
            setDispatchError(null)
          }}
        />
      )}
      {isStale && !pageError && (
        <div
          className="flex items-center justify-center gap-2 bg-[var(--color-warning)]/20 px-4 py-1.5 text-xs text-[var(--color-warning)]"
          role="status"
        >
          Data may be stale · last update {staleMinutes}m ago
        </div>
      )}

      <main id="main-content" className="flex-1 overflow-auto p-4">
        <h1 className="sr-only">Dispatch Monitor</h1>
        <div className="space-y-4">
          <DispatchStatsCards
            activeCount={activeCount}
            stalledCount={stalledDispatches.length}
            avgAcceptSeconds={avgAcceptSeconds}
            fcmSuccessRate={fcmSuccessRate}
            mode={stalledDispatches.length > 0 ? 'active' : 'calm'}
          />

          <section
            aria-label="Responder status queue"
            className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Responder Status
                </h2>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Active responder progress accepted through scene arrival.
                </p>
              </div>
              <span className="rounded border border-white/10 px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                {responderStatusRows.length} active
              </span>
            </div>
            {responderStatusRows.length === 0 ? (
              <p className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                No responder status updates waiting for review.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {responderStatusRows.map((row) => (
                  <article
                    key={row.dispatchId}
                    className="rounded border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {row.responderName || 'Responder'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {row.responderAgency || 'Agency pending'} · {row.reportId}
                        </p>
                      </div>
                      <span className="rounded bg-white/10 px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                        {responderStatusLabel(row.status)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section
            aria-label="Responder assignment queue"
            className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Responder Assignment
                </h2>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Verified reports waiting for first dispatch.
                </p>
              </div>
              <span className="rounded border border-white/10 px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                {assignmentReports.length} waiting
              </span>
            </div>
            {assignmentReports.length === 0 ? (
              <p className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                No verified reports waiting for responder assignment.
              </p>
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {assignmentReports.map((assignment) => {
                  const { report } = assignment
                  const candidates = candidateRespondersFor(assignment)
                  const selectedUid = assignmentSelections[report.id] ?? ''
                  const isAssigning = assigningReportId === report.id
                  return (
                    <article
                      key={report.id}
                      className="rounded border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="mb-3">
                        <p className="text-xs uppercase text-[var(--color-text-muted)]">
                          {report.municipality}
                          {report.barangay ? ` / ${report.barangay}` : ''}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                          {report.description || `Report ${report.id}`}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                          {report.type} · {report.severity}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <label className="sr-only" htmlFor={`assignment-responder-${report.id}`}>
                          Responder for {report.id}
                        </label>
                        <select
                          id={`assignment-responder-${report.id}`}
                          value={selectedUid}
                          onChange={(event) => {
                            const uid = event.target.value
                            setAssignmentSelections((current) => ({ ...current, [report.id]: uid }))
                          }}
                          className="min-w-0 flex-1 rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                        >
                          <option value="">
                            {candidates.length === 0
                              ? 'No responders available'
                              : 'Choose responder'}
                          </option>
                          {candidates.map((responder) => (
                            <option key={responder.uid} value={responder.uid}>
                              {responder.displayName || responder.uid}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedUid || isAssigning}
                          onClick={() => {
                            void handleAssignResponder(report.id)
                          }}
                          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isAssigning ? 'Assigning...' : 'Assign responder'}
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <EscalationQueueSection
            stalledDispatches={stalledDispatches.map((d) => ({
              dispatchId: d.dispatchId,
              reportId: d.reportId,
              responderName: d.responderName,
              escalationCount: d.escalationCount,
            }))}
            onReDispatch={handleReDispatch}
            mode={stalledDispatches.length > 0 ? 'active' : 'calm'}
          />

          <DispatchLifecycleTable rows={rows} highlightDispatchId={highlightDispatchId} />

          <ResponderAvailabilityPanel
            responders={responders}
            onCreateResponder={handleCreateResponder}
            creatingResponder={creatingResponder}
          />
        </div>
      </main>

      <ReDispatchModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDispatch={(responderUid, forceOverride) => {
          void handleDispatch(responderUid, forceOverride)
        }}
        responders={responders}
        previouslyNotified={previouslyNotified}
        isLoading={isDispatching}
      />

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
          setSuccessMessage('Alert declared successfully')
        }}
        onError={(msg) => {
          setDispatchError(msg)
        }}
      />
    </div>
  )
}
