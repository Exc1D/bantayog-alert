import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { getFirestoreInstance } from '../app/firebase'
import { useDispatchLifecycle } from '../hooks/useDispatchLifecycle'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { useResponderFleet } from '../hooks/useResponderFleet'
import { useResponderRoster } from '../hooks/useResponderRoster'
import { useOpsMetrics } from '../hooks/useOpsMetrics'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { DispatchStatsCards } from '../components/DispatchStatsCards'
import { EscalationQueueSection } from '../components/EscalationQueueSection'
import { DispatchLifecycleTable } from '../components/DispatchLifecycleTable'
import {
  AssignmentQueueSection,
  ResolvedDispatchesSection,
  ResponderStatusSection,
  type AssignmentReport,
} from '../components/DispatchQueueSections'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import { ResponderRosterSection } from '../components/ResponderRosterSection'
import { ReDispatchModal } from '../components/ReDispatchModal'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { OfflineBanner } from '../components/OfflineBanner'
import { SuccessBanner } from '../components/SuccessBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { PageSkeleton } from '../components/PageSkeleton'
import { HelpModal } from '../components/HelpModal'
import { callables, type CancelDispatchReason } from '../services/callables'
import { withRetry } from '../utils/withRetry'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import { actionErrorMessage, isRetryableActionError } from '../utils/errorClassification'

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
  | {
      kind: 'cancel'
      payload: { dispatchId: string; reason: CancelDispatchReason; idempotencyKey: string }
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
const RESOLVED_DISPATCH_LIMIT = 5

const RESPONDER_ACTION_COPY = {
  suspend: {
    title: 'Suspend responder',
    message:
      'The responder loses field access until reinstated and is signed out of active sessions.',
    confirmLabel: 'Suspend',
  },
  revoke: {
    title: 'Revoke responder access',
    message:
      'Revoking permanently removes field access and signs the responder out. This is not a routine action.',
    confirmLabel: 'Revoke',
  },
  off_duty: {
    title: 'Set responder off-duty',
    message: 'The responder is marked off-duty and stops receiving new dispatches.',
    confirmLabel: 'Set off-duty',
  },
} as const

async function executeDispatchCommand(command: FailedDispatchCommand): Promise<void> {
  if (command.kind === 'escalate') {
    await withRetry(() => callables.escalateDispatch(command.payload))
    return
  }
  if (command.kind === 'cancel') {
    await withRetry(() => callables.cancelDispatch(command.payload))
    return
  }
  await withRetry(() => callables.dispatchResponder(command.payload))
}

// fallow-ignore-next-line complexity
export function DispatchMonitorPage() {
  const db = getFirestoreInstance()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { claims } = useAuth()
  const canManageResponders = claims?.role === 'agency_admin'

  const { rows, loading, error } = useDispatchLifecycle(db)
  const { responders } = useResponderFleet(db)
  const { members: rosterMembers } = useResponderRoster(db)
  const { reports: assignmentReportDocs, error: assignmentError } = useFirestoreListeners({
    windowType: 'dashboard',
    db,
  })
  const { metrics: opsMetrics, error: metricsError } = useOpsMetrics('24h')

  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState<CancelDispatchReason>('admin_error')
  const [cancelling, setCancelling] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [assignmentSelections, setAssignmentSelections] = useState<Record<string, string>>({})
  const [assigningReportId, setAssigningReportId] = useState<string | null>(null)
  const [creatingResponder, setCreatingResponder] = useState(false)
  const [responderAction, setResponderAction] = useState<{
    uid: string
    kind: 'off_duty' | 'suspend' | 'revoke'
  } | null>(null)
  const [managingResponder, setManagingResponder] = useState(false)
  const [reinstatingUid, setReinstatingUid] = useState<string | null>(null)
  const [retryCommand, setRetryCommand] = useState<FailedDispatchCommand | null>(null)
  const [retryingAction, setRetryingAction] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  const highlightDispatchId = searchParams.get('highlight')
  const responderActionCopy = responderAction ? RESPONDER_ACTION_COPY[responderAction.kind] : null

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
  const rawFcmSuccessRate = opsMetrics?.fcmSuccessRate
  const fcmSuccessRate =
    typeof rawFcmSuccessRate === 'number' &&
    Number.isFinite(rawFcmSuccessRate) &&
    rawFcmSuccessRate >= 0 &&
    rawFcmSuccessRate <= 1
      ? rawFcmSuccessRate
      : null
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

  const handleOpenCancel = (dispatchId: string) => {
    setCancelTarget(dispatchId)
    setCancelReason('admin_error')
    setDispatchError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
  }

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return
    const command: FailedDispatchCommand = {
      kind: 'cancel',
      payload: {
        dispatchId: cancelTarget,
        reason: cancelReason,
        idempotencyKey: crypto.randomUUID(),
      },
      successMessage: 'Dispatch cancelled',
      errorFallback: 'Cancel failed',
    }
    setCancelling(true)
    setDispatchError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    try {
      await executeDispatchCommand(command)
      setSuccessMessage(command.successMessage)
      setCancelTarget(null)
    } catch (err) {
      setCancelTarget(null)
      setDispatchError(actionErrorMessage(err, command.errorFallback))
      if (isRetryableActionError(err)) {
        setRetryCommand(command)
      }
    } finally {
      setCancelling(false)
    }
  }

  const handleDispatch = async (responderUid: string, forceOverride?: true) => {
    if (!selectedDispatchId) return
    const command: FailedDispatchCommand = {
      kind: 'escalate',
      payload: {
        dispatchId: selectedDispatchId,
        newResponderUid: responderUid,
        idempotencyKey: crypto.randomUUID(),
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
    const idempotencyKey = crypto.randomUUID()
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

  const handleConfirmResponderAction = async () => {
    if (!responderAction) return
    const { uid, kind } = responderAction
    setManagingResponder(true)
    setDispatchError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    const idempotencyKey = crypto.randomUUID()
    try {
      if (kind === 'suspend') {
        await withRetry(() => callables.suspendResponder({ uid, idempotencyKey }))
        setSuccessMessage('Responder suspended')
      } else if (kind === 'revoke') {
        await withRetry(() => callables.revokeResponder({ uid, idempotencyKey }))
        setSuccessMessage('Responder access revoked')
      } else {
        // ponytail: off-duty here; the roster section reinstates via
        // bulkAvailabilityOverride({ status: 'available' }) once someone is off-shift.
        await withRetry(() =>
          callables.bulkAvailabilityOverride({ uids: [uid], status: 'off_duty', idempotencyKey }),
        )
        setSuccessMessage('Responder set off-duty')
      }
      setResponderAction(null)
    } catch (err) {
      setResponderAction(null)
      setDispatchError(actionErrorMessage(err, 'Responder action failed'))
    } finally {
      setManagingResponder(false)
    }
  }

  const handleReinstateResponder = async (uid: string) => {
    setReinstatingUid(uid)
    setDispatchError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    const idempotencyKey = crypto.randomUUID()
    try {
      await withRetry(() =>
        callables.bulkAvailabilityOverride({ uids: [uid], status: 'available', idempotencyKey }),
      )
      setSuccessMessage('Responder set available')
    } catch (err) {
      setDispatchError(actionErrorMessage(err, 'Set available failed'))
    } finally {
      setReinstatingUid(null)
    }
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
        idempotencyKey: crypto.randomUUID(),
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
    if (command.kind === 'cancel') {
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
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-surface)]">
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
      {metricsError != null && (
        <div
          aria-label="Metrics unavailable"
          className="flex items-center justify-center gap-2 bg-[var(--color-warning)]/10 px-4 py-1.5 text-xs text-[var(--color-text-secondary)]"
          role="status"
        >
          Metrics unavailable
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

          <ResponderStatusSection rows={responderStatusRows} />

          <AssignmentQueueSection
            assignments={assignmentReports}
            responders={responders}
            selections={assignmentSelections}
            assigningReportId={assigningReportId}
            onSelect={(reportId, uid) => {
              setAssignmentSelections((current) => ({ ...current, [reportId]: uid }))
            }}
            onAssign={(reportId) => {
              void handleAssignResponder(reportId)
            }}
          />

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

          <ResolvedDispatchesSection rows={resolvedDispatchRows} />

          <DispatchLifecycleTable
            rows={rows}
            highlightDispatchId={highlightDispatchId}
            onCancelDispatch={handleOpenCancel}
          />

          <ResponderAvailabilityPanel
            responders={responders}
            onCreateResponder={handleCreateResponder}
            creatingResponder={creatingResponder}
            {...(canManageResponders
              ? {
                  rowActions: {
                    onSetOffDuty: (uid: string) => {
                      setResponderAction({ uid, kind: 'off_duty' })
                    },
                    onSuspend: (uid: string) => {
                      setResponderAction({ uid, kind: 'suspend' })
                    },
                    onRevoke: (uid: string) => {
                      setResponderAction({ uid, kind: 'revoke' })
                    },
                  },
                }
              : {})}
          />

          {canManageResponders && (
            <ResponderRosterSection
              members={rosterMembers}
              onReinstate={(uid) => {
                void handleReinstateResponder(uid)
              }}
              reinstatingUid={reinstatingUid}
            />
          )}
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
        {...(retryCommand?.kind === 'escalate'
          ? {
              errorMessage: dispatchError,
              onRetry: () => {
                void handleRetryAction()
              },
              isRetrying: retryingAction,
            }
          : {})}
      />

      <ConfirmationModal
        open={cancelTarget !== null}
        title="Cancel dispatch"
        message="This returns the report to the verified queue for re-assignment and notifies the responder. Pick a reason."
        confirmLabel="Cancel dispatch"
        confirmVariant="danger"
        confirmLoading={cancelling}
        onConfirm={() => {
          void handleConfirmCancel()
        }}
        onCancel={() => {
          setCancelTarget(null)
        }}
      >
        <label className="mt-4 block text-sm text-[var(--color-text-secondary)]">
          Reason
          <select
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value as CancelDispatchReason)
            }}
            disabled={cancelling}
            className="mt-1 block w-full rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-carto-blue)] disabled:opacity-50"
          >
            <option value="admin_error">Dispatched by mistake</option>
            <option value="responder_unavailable">Responder unavailable</option>
            <option value="duplicate_report">Duplicate report</option>
            <option value="citizen_withdrew">Citizen withdrew</option>
          </select>
        </label>
      </ConfirmationModal>

      <ConfirmationModal
        open={responderAction !== null}
        title={responderActionCopy?.title ?? ''}
        message={responderActionCopy?.message ?? ''}
        confirmLabel={responderActionCopy?.confirmLabel ?? ''}
        confirmVariant={responderAction?.kind === 'off_duty' ? 'primary' : 'danger'}
        confirmLoading={managingResponder}
        onConfirm={() => {
          void handleConfirmResponderAction()
        }}
        onCancel={() => {
          setResponderAction(null)
        }}
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
    </div>
  )
}
