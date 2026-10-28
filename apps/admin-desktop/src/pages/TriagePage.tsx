import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { OfflineBanner } from '../components/OfflineBanner'
import { PageSkeleton } from '../components/PageSkeleton'
import { SuccessBanner } from '../components/SuccessBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { PermissionDeniedState } from '../components/PermissionDeniedState'
import { TriageQueueTable } from '../components/TriageQueueTable'
import { TriageFilters, type TriageFilterValues } from '../components/TriageFilters'
import {
  LifecycleDialog,
  MergeDialog,
  RejectDialog,
  type PendingLifecycle,
  type PendingMerge,
  type PendingRejection,
} from '../components/TriageDialogs'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { usePendingIds } from '../hooks/usePendingIds'
import { db } from '../app/firebase'
import { callables } from '../services/callables'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import { withRetry } from '../utils/withRetry'
import { buildTriageExportCsv, downloadCsv } from '../utils/triage-export'
import { actionErrorMessage, isRetryableActionError } from '../utils/errorClassification'
import type { RejectionReason } from '../constants/report'
import type { Report } from '../types'

const TRIAGE_STATUSES = new Set(['new', 'awaiting_verify', 'verified', 'reopened'])
const LIFECYCLE_STATUSES = new Set(['resolved', 'closed'])
const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'awaiting_verify', label: 'Awaiting verification' },
  { value: 'verified', label: 'Verified' },
  { value: 'reopened', label: 'Reopened' },
] as const
const DEFAULT_FILTERS: TriageFilterValues = {
  status: 'all',
  severity: 'all',
  type: 'all',
  search: '',
}

interface VerifyReportPayload {
  reportId: string
  idempotencyKey: string
}

interface RejectReportPayload {
  reportId: string
  reason: RejectionReason
  notes?: string
  idempotencyKey: string
}

type FailedTriageCommand =
  | {
      kind: 'verify'
      payload: VerifyReportPayload
      successMessage: string
      errorFallback: string
    }
  | {
      kind: 'reject'
      payload: RejectReportPayload
      successMessage: string
      errorFallback: string
    }

function isPermissionDeniedError(error: string | null): boolean {
  return ['unauthorized', 'permission-denied', 'permission_denied', 'denied'].includes(error ?? '')
}

function sortTriageReports(a: Report, b: Report): number {
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  return (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4)
}

function reportMatchesSearch(report: Report, query: string): boolean {
  if (!query) return true
  const haystack = [
    report.description,
    report.type,
    report.status,
    report.severity,
    report.municipality,
    report.barangay,
    report.id,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

// fallow-ignore-next-line complexity
export default function TriagePage() {
  const { signOut, claims } = useAuth()
  const canManageLifecycle =
    claims?.role === 'municipal_admin' || claims?.role === 'provincial_superadmin'
  const navigate = useNavigate()
  const {
    loading,
    error,
    reports: reportDocs,
  } = useFirestoreListeners({
    windowType: 'dashboard',
    db,
  })

  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadingIds, whileLoading] = usePendingIds()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TriageFilterValues>(DEFAULT_FILTERS)
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [pendingRejection, setPendingRejection] = useState<PendingRejection | null>(null)
  const [retryCommand, setRetryCommand] = useState<FailedTriageCommand | null>(null)
  const [retryingAction, setRetryingAction] = useState(false)
  const [pendingMerge, setPendingMerge] = useState<PendingMerge | null>(null)
  const [merging, setMerging] = useState(false)
  const [pendingLifecycle, setPendingLifecycle] = useState<PendingLifecycle | null>(null)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)

  const reports = useMemo<Report[]>(
    () =>
      reportDocs
        .map((report) => mapReportDocToReportLoose(report))
        .filter(
          (report) =>
            TRIAGE_STATUSES.has(report.status) ||
            (canManageLifecycle && LIFECYCLE_STATUSES.has(report.status)),
        ),
    [reportDocs, canManageLifecycle],
  )
  const typeOptions = useMemo(
    () => Array.from(new Set(reports.map((report) => report.type))).sort(),
    [reports],
  )
  const statusFilterOptions = useMemo<{ value: string; label: string }[]>(
    () =>
      canManageLifecycle
        ? [
            ...STATUS_FILTERS,
            { value: 'resolved', label: 'Resolved' },
            { value: 'closed', label: 'Closed' },
          ]
        : [...STATUS_FILTERS],
    [canManageLifecycle],
  )
  const filteredReports = useMemo<Report[]>(() => {
    const { status, severity, type, search } = filters
    const normalizedSearch = search.trim().toLowerCase()
    return reports.filter((report) => {
      if (status === 'all' && LIFECYCLE_STATUSES.has(report.status)) return false
      if (status !== 'all' && report.status !== status) return false
      if (severity !== 'all' && report.severity !== severity) return false
      if (type !== 'all' && report.type !== type) return false
      return reportMatchesSearch(report, normalizedSearch)
    })
  }, [reports, filters])
  const sortedReports = useMemo<Report[]>(
    () => [...filteredReports].sort(sortTriageReports),
    [filteredReports],
  )
  const clearSelection = () => {
    setSelectedIds(new Set())
  }
  // Any filter change invalidates the selection: hidden rows must not stay selected.
  const updateFilters = (patch: Partial<TriageFilterValues>) => {
    setFilters((current) => ({ ...current, ...patch }))
    clearSelection()
  }
  const clearFilters = () => {
    updateFilters(DEFAULT_FILTERS)
  }
  const handleExportCsv = () => {
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`bantayog-triage-${date}.csv`, buildTriageExportCsv(sortedReports))
  }

  const reportSnapshotKey = useMemo(
    () =>
      reportDocs
        .map((report) => {
          const submittedAt =
            typeof report.submittedAt === 'string' || typeof report.submittedAt === 'number'
              ? String(report.submittedAt)
              : ''
          return `${report.id}:${submittedAt}:${report.status}:${report.description}`
        })
        .join('|'),
    [reportDocs],
  )

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loading) {
      setLastDataUpdateAt(Date.now())
    }
  }, [loading, reportSnapshotKey])
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 60000)
    return () => {
      window.clearInterval(id)
    }
  }, [])
  const staleAgeMs = now - lastDataUpdateAt
  const isStale = staleAgeMs > 5 * 60 * 1000
  const staleMinutes = Math.round(staleAgeMs / 60000)
  const isPermissionDenied = isPermissionDeniedError(error)

  const buildVerifyCommand = (reportId: string): FailedTriageCommand => {
    const report = sortedReports.find((item) => item.id === reportId)
    return {
      kind: 'verify',
      payload: { reportId, idempotencyKey: crypto.randomUUID() },
      successMessage: report?.status === 'new' ? 'Report sent to review' : 'Report verified',
      errorFallback: 'Report verification failed',
    }
  }

  const buildRejectCommand = (
    reportId: string,
    reason: RejectionReason,
    note: string,
  ): FailedTriageCommand => ({
    kind: 'reject',
    payload: {
      reportId,
      reason,
      ...(note ? { notes: note } : {}),
      idempotencyKey: crypto.randomUUID(),
    },
    successMessage: 'Report rejected',
    errorFallback: 'Report rejection failed',
  })

  const executeCommand = async (command: FailedTriageCommand) => {
    const { reportId } = command.payload
    await whileLoading(reportId, () =>
      withRetry(() =>
        command.kind === 'verify'
          ? callables.verifyReport(command.payload)
          : callables.rejectReport(command.payload),
      ),
    )
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(reportId)
      return next
    })
  }

  const handleVerify = async (reportId: string) => {
    const command = buildVerifyCommand(reportId)
    setActionError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    try {
      await executeCommand(command)
      setSuccessMessage(command.successMessage)
    } catch (err) {
      setActionError(actionErrorMessage(err, command.errorFallback))
      if (isRetryableActionError(err)) {
        setRetryCommand(command)
      }
    }
  }

  const openRejectConfirmation = (reportIds: string[], scope: PendingRejection['scope']) => {
    if (reportIds.length === 0) return
    setActionError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    setPendingRejection({
      reportIds,
      reason: 'insufficient_detail',
      note: '',
      scope,
    })
  }

  const handleReject = (reportId: string) => {
    openRejectConfirmation([reportId], 'single')
  }

  const handleToggleSelect = (reportId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(reportId)) next.delete(reportId)
      else next.add(reportId)
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedIds((current) => {
      if (current.size === sortedReports.length) return new Set()
      return new Set(sortedReports.map((report) => report.id))
    })
  }

  const selectedReports = useMemo(
    () => sortedReports.filter((r) => selectedIds.has(r.id)),
    [sortedReports, selectedIds],
  )

  const bulkVerifyIds = useMemo(
    () =>
      selectedReports
        .filter((r) => r.status === 'new' || r.status === 'awaiting_verify')
        .map((r) => r.id),
    [selectedReports],
  )

  const bulkRejectIds = useMemo(
    () => selectedReports.filter((r) => r.status === 'awaiting_verify').map((r) => r.id),
    [selectedReports],
  )

  const handleBulkVerify = async (ids: Set<string>) => {
    const eligibleIds = Array.from(ids).filter((id) => {
      const report = sortedReports.find((r) => r.id === id)
      return report && (report.status === 'new' || report.status === 'awaiting_verify')
    })
    if (eligibleIds.length === 0) return
    setBulkLoading(true)
    setActionError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    const errors: string[] = []
    for (const reportId of eligibleIds) {
      const command = buildVerifyCommand(reportId)
      try {
        await executeCommand(command)
      } catch (err) {
        errors.push(actionErrorMessage(err, `Failed to verify ${reportId}`))
      }
    }
    if (errors.length > 0) {
      setActionError(
        `Bulk verify completed with ${String(errors.length)} error(s): ${errors.join('; ')}`,
      )
    } else {
      setSuccessMessage(`${String(eligibleIds.length)} report(s) verified`)
    }
    setBulkLoading(false)
  }

  const handleBulkReject = (ids: Set<string>) => {
    const eligibleIds = Array.from(ids).filter((id) => {
      const report = sortedReports.find((r) => r.id === id)
      return report?.status === 'awaiting_verify'
    })
    if (eligibleIds.length === 0) return
    setActionError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    openRejectConfirmation(eligibleIds, 'bulk')
  }

  const handleConfirmReject = async () => {
    const pending = pendingRejection
    if (!pending) return

    setPendingRejection(null)
    setActionError(null)
    setSuccessMessage(null)
    setRetryCommand(null)

    if (pending.reportIds.length === 1) {
      const reportId = pending.reportIds[0]
      if (!reportId) return

      const command = buildRejectCommand(reportId, pending.reason, pending.note.trim())
      try {
        await executeCommand(command)
        setSuccessMessage(command.successMessage)
      } catch (err) {
        setActionError(actionErrorMessage(err, command.errorFallback))
        if (isRetryableActionError(err)) {
          setRetryCommand(command)
        }
      }
      return
    }

    const commands = pending.reportIds.map((reportId) =>
      buildRejectCommand(reportId, pending.reason, pending.note.trim()),
    )
    setBulkLoading(true)
    const errors: string[] = []
    for (const command of commands) {
      try {
        await executeCommand(command)
      } catch (err) {
        errors.push(actionErrorMessage(err, `Failed to reject ${command.payload.reportId}`))
      }
    }
    if (errors.length > 0) {
      setActionError(
        `Bulk reject completed with ${String(errors.length)} error(s): ${errors.join('; ')}`,
      )
    } else {
      setSuccessMessage(`${String(commands.length)} report(s) rejected`)
    }
    setBulkLoading(false)
  }

  const handleRetryAction = async () => {
    const command = retryCommand
    if (!command) return

    setRetryingAction(true)
    setActionError(null)
    setSuccessMessage(null)
    try {
      await executeCommand(command)
      setSuccessMessage(command.successMessage)
      setRetryCommand(null)
    } catch (err) {
      setActionError(actionErrorMessage(err, command.errorFallback))
      if (isRetryableActionError(err)) {
        setRetryCommand(command)
      } else {
        setRetryCommand(null)
      }
    } finally {
      setRetryingAction(false)
    }
  }

  const openMergeConfirmation = () => {
    if (!canManageLifecycle || merging) return
    const ids = selectedReports.map((report) => report.id)
    if (ids.length < 2) return
    setActionError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    // ponytail: primary defaults to the first selected row; operator repicks in the modal.
    setPendingMerge({ primaryId: ids[0] ?? '', ids })
  }

  const handleConfirmMerge = async () => {
    const pending = pendingMerge
    if (!pending) return
    const duplicateReportIds = pending.ids.filter((id) => id !== pending.primaryId)
    if (duplicateReportIds.length === 0) return
    setMerging(true)
    setActionError(null)
    setSuccessMessage(null)
    const idempotencyKey = crypto.randomUUID()
    try {
      const result = await withRetry(() =>
        callables.mergeDuplicates({
          primaryReportId: pending.primaryId,
          duplicateReportIds,
          idempotencyKey,
        }),
      )
      if (result.success) {
        setSuccessMessage(`${String(result.mergedCount)} duplicate report(s) merged`)
        clearSelection()
      } else {
        setActionError(`Merge failed (${result.errorCode})`)
      }
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Merge failed'))
    } finally {
      setPendingMerge(null)
      setMerging(false)
    }
  }

  const openLifecycle = (kind: 'close' | 'reopen', reportId: string) => {
    if (!canManageLifecycle) return
    setActionError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    setPendingLifecycle({ kind, reportId, text: '' })
  }

  const handleConfirmLifecycle = async () => {
    const pending = pendingLifecycle
    if (!pending) return
    const text = pending.text.trim()
    if (pending.kind === 'reopen' && !text) return
    setPendingLifecycle(null)
    setLifecycleBusy(true)
    setActionError(null)
    setSuccessMessage(null)
    const idempotencyKey = crypto.randomUUID()
    try {
      await whileLoading(pending.reportId, async () => {
        if (pending.kind === 'close') {
          await withRetry(() =>
            callables.closeReport({
              reportId: pending.reportId,
              idempotencyKey,
              ...(text ? { closureSummary: text } : {}),
            }),
          )
          setSuccessMessage('Report closed')
        } else {
          await withRetry(() =>
            callables.reopenReport({
              reportId: pending.reportId,
              reason: text,
              idempotencyKey,
            }),
          )
          setSuccessMessage('Report reopened')
        }
      })
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Report lifecycle action failed'))
    } finally {
      setLifecycleBusy(false)
    }
  }

  const handleRowClick = (report: Report) => {
    if (report.status === 'verified') {
      void navigate(`/map?reportId=${report.id}`)
    }
  }

  if (loading) return <PageSkeleton variant="dashboard" />

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-surface)]">
      <OfflineBanner
        error={isPermissionDenied ? null : error}
        onRetry={() => {
          window.location.reload()
        }}
      />
      {isStale && !error && (
        <div
          className="flex items-center justify-center gap-2 bg-[var(--color-warning)]/20 px-4 py-1.5 text-xs text-[var(--color-warning)]"
          role="status"
        >
          Triage data may be stale · last update {staleMinutes}m ago
        </div>
      )}
      <main className="flex-1 overflow-auto p-4">
        {isPermissionDenied ? (
          <PermissionDeniedState
            onSignOut={() => {
              void signOut()
            }}
          />
        ) : (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                  Triage workbench
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Review incoming reports, verify dispatch-ready incidents, and route verified
                  reports to the map.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManageLifecycle && (
                  <button
                    type="button"
                    onClick={openMergeConfirmation}
                    disabled={selectedIds.size < 2 || merging}
                    className="rounded border border-white/10 px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Merge duplicates
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={sortedReports.length === 0}
                  className="rounded border border-white/10 px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Export CSV
                </button>
                <div className="rounded border border-white/10 bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                  {sortedReports.length} report{sortedReports.length === 1 ? '' : 's'} in queue
                </div>
              </div>
            </section>
            <TriageFilters
              values={filters}
              statusOptions={statusFilterOptions}
              typeOptions={typeOptions}
              onChange={updateFilters}
              onClear={clearFilters}
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
            <section
              aria-label="Incoming report triage queue"
              className="overflow-hidden rounded border border-white/10 bg-[var(--color-surface-elevated)]"
            >
              <TriageQueueTable
                reports={sortedReports}
                selectedIds={selectedIds}
                loadingIds={loadingIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onVerify={(reportId) => {
                  void handleVerify(reportId)
                }}
                onReject={(reportId) => {
                  handleReject(reportId)
                }}
                onDispatch={(reportId) => {
                  void navigate(`/map?reportId=${reportId}`)
                }}
                onRowClick={handleRowClick}
                bulkLoading={bulkLoading}
                bulkVerifyIds={new Set(bulkVerifyIds)}
                bulkRejectIds={new Set(bulkRejectIds)}
                onBulkVerify={(ids) => {
                  void handleBulkVerify(ids)
                }}
                onBulkReject={(ids) => {
                  handleBulkReject(ids)
                }}
                {...(canManageLifecycle
                  ? {
                      onClose: (reportId: string) => {
                        openLifecycle('close', reportId)
                      },
                      onReopen: (reportId: string) => {
                        openLifecycle('reopen', reportId)
                      },
                    }
                  : {})}
              />
            </section>
          </div>
        )}
      </main>
      <RejectDialog
        pending={pendingRejection}
        onChange={(patch) => {
          setPendingRejection((current) => (current ? { ...current, ...patch } : current))
        }}
        onConfirm={() => {
          void handleConfirmReject()
        }}
        onCancel={() => {
          setPendingRejection(null)
        }}
      />
      <MergeDialog
        pending={pendingMerge}
        reports={reports}
        merging={merging}
        onPrimaryChange={(primaryId) => {
          setPendingMerge((current) => (current ? { ...current, primaryId } : current))
        }}
        onConfirm={() => {
          void handleConfirmMerge()
        }}
        onCancel={() => {
          setPendingMerge(null)
        }}
      />
      <LifecycleDialog
        pending={pendingLifecycle}
        busy={lifecycleBusy}
        onTextChange={(text) => {
          setPendingLifecycle((current) => (current ? { ...current, text } : current))
        }}
        onConfirm={() => {
          void handleConfirmLifecycle()
        }}
        onCancel={() => {
          setPendingLifecycle(null)
        }}
      />
    </div>
  )
}
