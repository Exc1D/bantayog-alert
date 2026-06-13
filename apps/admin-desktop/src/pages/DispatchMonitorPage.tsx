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
import { actionErrorMessage, isRetryableActionError } from '../utils/errorClassification'
import type { Report } from '../types'

interface AssignmentReport {
  report: Report
  municipalityId?: string
}

interface EscalateDispatchPayload {
  dispatchId: string
  newResponderUid: string
  idempotencyKey: string
  forceOverride?: boolean
}

interface DispatchResponderPayload {
  reportId: string
  responderUid: string
  idempotencyKey: string
}

type FailedDispatchCommand =
  | {
      kind: 'escalate'
      payload: EscalateDispatchPayload
      successMessage: string
      errorFallback: string
    }
  | {
      kind: 'assign'
      payload: DispatchResponderPayload
      successMessage: string
      errorFallback: string
    }

const FIELD_PROGRESS_STATUSES = new Set([
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
])
const SLA_COUNTDOWN_STATUSES = new Set(['pending', 'accepted'])
const RESOLVED_DISPATCH_LIMIT = 5

async function executeDispatchCommand(command: FailedDispatchCommand): Promise<void> {
  if (command.kind === 'escalate') {
    await withRetry(() => callables.escalateDispatch(command.payload))
    return
  }
  await withRetry(() => callables.dispatchResponder(command.payload))
}

function responderStatusLabel(status: string): string {
  if (status === 'pending') return 'Pending'
  if (status === 'accepted') return 'Accepted'
  if (status === 'acknowledged') return 'Acknowledged'
  if (status === 'en_route') return 'En route'
  if (status === 'on_scene') return 'On scene'
  return status.replace(/_/g, ' ')
}

function formatSlaDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  if (totalSeconds < 60) return `${String(totalSeconds)}s`

  const totalMinutes = Math.ceil(totalSeconds / 60)
  if (totalMinutes < 60) return `${String(totalMinutes)}m`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${String(hours)}h ${String(minutes)}m` : `${String(hours)}h`
}

function formatResolvedAt(resolvedAt: number | undefined): string {
  if (resolvedAt === undefined) return 'Resolved time not recorded'

  return `Resolved ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(resolvedAt))}`
}

function SlaCountdown({ deadlineAt }: { deadlineAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  const isOverdue = now > deadlineAt
  const duration = formatSlaDuration(isOverdue ? now - deadlineAt : deadlineAt - now)
  const label = isOverdue ? `SLA overdue by ${duration}` : `SLA due in ${duration}`

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [])

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${
        isOverdue
          ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
          : 'border-[var(--color-warning)]/50 bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
      }`}
    >
      <span className="font-mono">SLA</span>{' '}
      {isOverdue ? `Overdue by ${duration}` : `${duration} left`}
    </span>
  )
}

// fallow-ignore-next-line complexity
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
  const [retryCommand, setRetryCommand] = useState<FailedDispatchCommand | null>(null)
  const [retryingAction, setRetryingAction] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [alertModalOpen, setAlertModalOpen] = useState(false)
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  const highlightDispatchId = searchParams.get('highlight')

  const stalledDispatches = rows.filter((r) => r.status === 'needs_admin')
  const responderStatusRows = rows.filter((r) => FIELD_PROGRESS_STATUSES.has(r.status))
  const activeCount = rows.filter(
    (r) => r.status !== 'needs_admin' && r.status !== 'resolved',
  ).length
  const resolvedDispatchRows = rows
    .filter((r) => r.status === 'resolved')
    .sort((a, b) => (b.resolvedAt ?? b.dispatchedAt) - (a.resolvedAt ?? a.dispatchedAt))
    .slice(0, RESOLVED_DISPATCH_LIMIT)
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
            row.resolvedAt ?? '',
            row.resolutionSummary ?? '',
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
    setSuccessMessage(null)
    setRetryCommand(null)
  }

  const handleCloseModal = () => {
    setSelectedDispatchId(null)
    setIsModalOpen(false)
    setDispatchError(null)
    setRetryCommand(null)
  }

  const handleDispatch = async (responderUid: string, forceOverride?: true) => {
    if (!selectedDispatchId) return
    const command: FailedDispatchCommand = {
      kind: 'escalate',
      payload: {
        dispatchId: selectedDispatchId,
        newResponderUid: responderUid,
        idempotencyKey: generateIdempotencyKey(),
        ...(forceOverride ? { forceOverride } : {}),
      },
      successMessage: 'Re-dispatched successfully',
      errorFallback: 'Re-dispatch failed',
    }
    setIsDispatching(true)
    setDispatchError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    try {
      await executeDispatchCommand(command)
      setSuccessMessage(command.successMessage)
      setIsModalOpen(false)
      setSelectedDispatchId(null)
    } catch (err) {
      setDispatchError(actionErrorMessage(err, command.errorFallback))
      if (isRetryableActionError(err)) {
        setRetryCommand(command)
      }
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
    setRetryCommand(null)
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
      setRetryCommand(null)
      return
    }

    const command: FailedDispatchCommand = {
      kind: 'assign',
      payload: {
        reportId,
        responderUid,
        idempotencyKey: generateIdempotencyKey(),
      },
      successMessage: 'Responder assigned',
      errorFallback: 'Responder assignment failed',
    }
    setAssigningReportId(reportId)
    setDispatchError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    try {
      await executeDispatchCommand(command)
      setSuccessMessage(command.successMessage)
      setAssignmentSelections((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== reportId)),
      )
    } catch (err) {
      setDispatchError(actionErrorMessage(err, command.errorFallback))
      if (isRetryableActionError(err)) {
        setRetryCommand(command)
      }
    } finally {
      setAssigningReportId(null)
    }
  }

  const completeDispatchCommand = (command: FailedDispatchCommand) => {
    if (command.kind === 'escalate') {
      setIsModalOpen(false)
      setSelectedDispatchId(null)
      return
    }
    setAssignmentSelections((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => id !== command.payload.reportId)),
    )
  }

  const handleRetryAction = async () => {
    const command = retryCommand
    if (!command) return

    setRetryingAction(true)
    setDispatchError(null)
    setSuccessMessage(null)
    try {
      await executeDispatchCommand(command)
      completeDispatchCommand(command)
      setSuccessMessage(command.successMessage)
      setRetryCommand(null)
    } catch (err) {
      setDispatchError(actionErrorMessage(err, command.errorFallback))
      if (isRetryableActionError(err)) {
        setRetryCommand(command)
      } else {
        setRetryCommand(null)
      }
    } finally {
      setRetryingAction(false)
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
      {dispatchError && !isModalOpen && (
        <ActionErrorBanner
          message={dispatchError}
          onDismiss={() => {
            setDispatchError(null)
            setRetryCommand(null)
          }}
          {...(retryCommand
            ? {
                onRetry: () => {
                  void handleRetryAction()
                },
                retrying: retryingAction,
              }
            : {})}
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
                  Active responder progress pending through scene arrival.
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
                    data-dispatch-id={row.dispatchId}
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
                    {SLA_COUNTDOWN_STATUSES.has(row.status) && row.deadlineAt > 0 ? (
                      <div className="mt-3">
                        <SlaCountdown deadlineAt={row.deadlineAt} />
                      </div>
                    ) : null}
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

          {resolvedDispatchRows.length > 0 ? (
            <section
              aria-label="Recently resolved dispatches"
              className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                    Recently Resolved
                  </h2>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Closed responder work from the current dispatch window.
                  </p>
                </div>
                <span className="rounded border border-[var(--color-success)]/30 px-2 py-1 text-xs text-[var(--color-success)]">
                  {resolvedDispatchRows.length} closed
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {resolvedDispatchRows.map((row) => {
                  const summary = row.resolutionSummary?.trim()
                  const resolutionText =
                    summary && summary.length > 0 ? summary : 'No resolution summary recorded.'

                  return (
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
                        <span className="rounded bg-[var(--color-success)]/15 px-2 py-1 text-xs font-semibold text-[var(--color-success)]">
                          Resolved
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                        {formatResolvedAt(row.resolvedAt)}
                      </p>
                      <p className="mt-2 rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                        {resolutionText}
                      </p>
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

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
        errorMessage={dispatchError}
        {...(retryCommand?.kind === 'escalate'
          ? {
              onRetry: () => {
                void handleRetryAction()
              },
            }
          : {})}
        retrying={retryingAction}
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
