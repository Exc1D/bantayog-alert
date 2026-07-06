import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { OfflineBanner } from '../components/OfflineBanner'
import { PageSkeleton } from '../components/PageSkeleton'
import { SuccessBanner } from '../components/SuccessBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { PermissionDeniedState } from '../components/PermissionDeniedState'
import { TriageQueueTable } from '../components/TriageQueueTable'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { db } from '../app/firebase'
import { callables } from '../services/callables'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { withRetry } from '../utils/withRetry'
import { actionErrorMessage, isRetryableActionError } from '../utils/errorClassification'
import {
  REJECTION_REASONS,
  isValidRejectionReason,
  type RejectionReason,
} from '../constants/report'
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
const SEVERITY_FILTERS = [
  { value: 'all', label: 'All severities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const
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

interface PendingRejection {
  reportIds: string[]
  reason: RejectionReason
  note: string
  scope: 'single' | 'bulk'
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

function filterLabel(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function reportCountLabel(count: number): string {
  return `${String(count)} report${count === 1 ? '' : 's'}`
}

function csvCell(value: string | number): string {
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

export function buildTriageExportCsv(reports: readonly Report[]): string {
  const rows = [
    [
      'reportId',
      'type',
      'severity',
      'status',
      'municipality',
      'barangay',
      'description',
      'createdAt',
    ],
    ...reports.map((report) => [
      report.id,
      report.type,
      report.severity,
      report.status,
      report.municipality,
      report.barangay,
      report.description,
      report.createdAt,
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
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
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [pendingRejection, setPendingRejection] = useState<PendingRejection | null>(null)
  const [retryCommand, setRetryCommand] = useState<FailedTriageCommand | null>(null)
  const [retryingAction, setRetryingAction] = useState(false)
  const [pendingMerge, setPendingMerge] = useState<{ primaryId: string; ids: string[] } | null>(
    null,
  )
  const [merging, setMerging] = useState(false)
  const [pendingLifecycle, setPendingLifecycle] = useState<{
    kind: 'close' | 'reopen'
    reportId: string
    text: string
  } | null>(null)
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
    const normalizedSearch = searchQuery.trim().toLowerCase()
    return reports.filter((report) => {
      if (statusFilter === 'all' && LIFECYCLE_STATUSES.has(report.status)) return false
      if (statusFilter !== 'all' && report.status !== statusFilter) return false
      if (severityFilter !== 'all' && report.severity !== severityFilter) return false
      if (typeFilter !== 'all' && report.type !== typeFilter) return false
      return reportMatchesSearch(report, normalizedSearch)
    })
  }, [reports, searchQuery, severityFilter, statusFilter, typeFilter])
  const sortedReports = useMemo<Report[]>(
    () => [...filteredReports].sort(sortTriageReports),
    [filteredReports],
  )
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])
  const clearFilters = useCallback(() => {
    setStatusFilter('all')
    setSeverityFilter('all')
    setTypeFilter('all')
    setSearchQuery('')
    clearSelection()
  }, [clearSelection])
  const handleExportCsv = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10)
    downloadCsv(`bantayog-triage-${date}.csv`, buildTriageExportCsv(sortedReports))
  }, [sortedReports])

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

  const setReportLoading = useCallback((reportId: string, isLoading: boolean) => {
    setLoadingIds((current) => {
      const next = new Set(current)
      if (isLoading) next.add(reportId)
      else next.delete(reportId)
      return next
    })
  }, [])

  const executeVerify = useCallback(
    async (payload: VerifyReportPayload) => {
      setReportLoading(payload.reportId, true)
      try {
        await withRetry(() => callables.verifyReport(payload))
        setSelectedIds((current) => {
          const next = new Set(current)
          next.delete(payload.reportId)
          return next
        })
      } finally {
        setReportLoading(payload.reportId, false)
      }
    },
    [setReportLoading],
  )

  const executeReject = useCallback(
    async (payload: RejectReportPayload) => {
      setReportLoading(payload.reportId, true)
      try {
        await withRetry(() => callables.rejectReport(payload))
        setSelectedIds((current) => {
          const next = new Set(current)
          next.delete(payload.reportId)
          return next
        })
      } finally {
        setReportLoading(payload.reportId, false)
      }
    },
    [setReportLoading],
  )

  const buildVerifyCommand = useCallback(
    (reportId: string): FailedTriageCommand => {
      const report = sortedReports.find((item) => item.id === reportId)
      return {
        kind: 'verify',
        payload: { reportId, idempotencyKey: generateIdempotencyKey() },
        successMessage: report?.status === 'new' ? 'Report sent to review' : 'Report verified',
        errorFallback: 'Report verification failed',
      }
    },
    [sortedReports],
  )

  const buildRejectCommand = useCallback(
    (reportId: string, reason: RejectionReason, note: string): FailedTriageCommand => ({
      kind: 'reject',
      payload: {
        reportId,
        reason,
        ...(note ? { notes: note } : {}),
        idempotencyKey: generateIdempotencyKey(),
      },
      successMessage: 'Report rejected',
      errorFallback: 'Report rejection failed',
    }),
    [],
  )

  const executeCommand = useCallback(
    async (command: FailedTriageCommand) => {
      if (command.kind === 'verify') {
        await executeVerify(command.payload)
        return
      }
      await executeReject(command.payload)
    },
    [executeReject, executeVerify],
  )

  const handleVerify = useCallback(
    async (reportId: string) => {
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
    },
    [buildVerifyCommand, executeCommand],
  )

  const openRejectConfirmation = useCallback(
    (reportIds: string[], scope: PendingRejection['scope']) => {
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
    },
    [],
  )

  const handleReject = useCallback(
    (reportId: string) => {
      openRejectConfirmation([reportId], 'single')
    },
    [openRejectConfirmation],
  )

  const handleToggleSelect = useCallback((reportId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(reportId)) next.delete(reportId)
      else next.add(reportId)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds((current) => {
      if (current.size === sortedReports.length) return new Set()
      return new Set(sortedReports.map((report) => report.id))
    })
  }, [sortedReports])

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

  const handleBulkVerify = useCallback(
    async (ids: Set<string>) => {
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
    },
    [buildVerifyCommand, executeCommand, sortedReports],
  )

  const handleBulkReject = useCallback(
    (ids: Set<string>) => {
      const eligibleIds = Array.from(ids).filter((id) => {
        const report = sortedReports.find((r) => r.id === id)
        return report?.status === 'awaiting_verify'
      })
      if (eligibleIds.length === 0) return
      setActionError(null)
      setSuccessMessage(null)
      setRetryCommand(null)
      openRejectConfirmation(eligibleIds, 'bulk')
    },
    [openRejectConfirmation, sortedReports],
  )

  const handleConfirmReject = useCallback(async () => {
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
  }, [buildRejectCommand, executeCommand, pendingRejection])

  const handleRetryAction = useCallback(async () => {
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
  }, [executeCommand, retryCommand])

  const openMergeConfirmation = useCallback(() => {
    if (!canManageLifecycle || merging) return
    const ids = selectedReports.map((report) => report.id)
    if (ids.length < 2) return
    setActionError(null)
    setSuccessMessage(null)
    setRetryCommand(null)
    // ponytail: primary defaults to the first selected row; operator repicks in the modal.
    setPendingMerge({ primaryId: ids[0] ?? '', ids })
  }, [canManageLifecycle, merging, selectedReports])

  const handleConfirmMerge = useCallback(async () => {
    const pending = pendingMerge
    if (!pending) return
    const duplicateReportIds = pending.ids.filter((id) => id !== pending.primaryId)
    if (duplicateReportIds.length === 0) return
    setMerging(true)
    setActionError(null)
    setSuccessMessage(null)
    const idempotencyKey = generateIdempotencyKey()
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
  }, [clearSelection, pendingMerge])

  const openLifecycle = useCallback(
    (kind: 'close' | 'reopen', reportId: string) => {
      if (!canManageLifecycle) return
      setActionError(null)
      setSuccessMessage(null)
      setRetryCommand(null)
      setPendingLifecycle({ kind, reportId, text: '' })
    },
    [canManageLifecycle],
  )

  const handleConfirmLifecycle = useCallback(async () => {
    const pending = pendingLifecycle
    if (!pending) return
    const text = pending.text.trim()
    if (pending.kind === 'reopen' && !text) return
    setPendingLifecycle(null)
    setLifecycleBusy(true)
    setReportLoading(pending.reportId, true)
    setActionError(null)
    setSuccessMessage(null)
    const idempotencyKey = generateIdempotencyKey()
    try {
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
    } catch (err) {
      setActionError(actionErrorMessage(err, 'Report lifecycle action failed'))
    } finally {
      setReportLoading(pending.reportId, false)
      setLifecycleBusy(false)
    }
  }, [pendingLifecycle, setReportLoading])

  const pendingRejectionCount = pendingRejection?.reportIds.length ?? 0
  const pendingRejectionCountLabel = reportCountLabel(pendingRejectionCount)
  const isBulkRejection = pendingRejection?.scope === 'bulk'
  const pendingRejectionTitle = isBulkRejection ? 'Reject selected reports?' : 'Reject report?'
  const pendingRejectionConfirmLabel = isBulkRejection
    ? `Reject ${pendingRejectionCountLabel}`
    : 'Reject report'

  const handleRowClick = useCallback(
    (report: Report) => {
      if (report.status === 'verified') {
        void navigate(`/map?reportId=${report.id}`)
      }
    },
    [navigate],
  )

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
            <section
              aria-label="Triage filters"
              className="grid gap-3 rounded border border-white/10 bg-[var(--color-surface-elevated)] p-4 md:grid-cols-6"
            >
              <label className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                Status filter
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value)
                    clearSelection()
                  }}
                  className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
                >
                  {statusFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                Severity filter
                <select
                  value={severityFilter}
                  onChange={(event) => {
                    setSeverityFilter(event.target.value)
                    clearSelection()
                  }}
                  className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
                >
                  {SEVERITY_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                Type filter
                <select
                  value={typeFilter}
                  onChange={(event) => {
                    setTypeFilter(event.target.value)
                    clearSelection()
                  }}
                  className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
                >
                  <option value="all">All types</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>
                      {filterLabel(type)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-xs font-semibold uppercase text-[var(--color-text-muted)] md:col-span-2">
                <label htmlFor="triage-search">Search triage reports</label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="triage-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value)
                      clearSelection()
                    }}
                    className="min-w-0 flex-1 rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
                    placeholder="Search summary, place, type, or report ID"
                  />
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded border border-white/10 px-3 py-2 text-sm font-medium normal-case text-[var(--color-text-secondary)] hover:bg-white/10"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            </section>
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
      <ConfirmationModal
        open={pendingRejection !== null}
        title={pendingRejectionTitle}
        message="Rejecting keeps the report out of active triage while preserving the audit trail."
        confirmLabel={pendingRejectionConfirmLabel}
        confirmVariant="danger"
        onConfirm={() => {
          void handleConfirmReject()
        }}
        onCancel={() => {
          setPendingRejection(null)
        }}
      >
        <div className="mt-4 grid gap-3 rounded border border-white/10 bg-white/[0.03] p-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[var(--color-text-secondary)]">Reports</span>
            <span className="font-medium text-[var(--color-text-primary)]">
              {pendingRejectionCountLabel}
            </span>
          </div>
          <label className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Rejection reason
            <select
              aria-label="Rejection reason"
              value={pendingRejection?.reason ?? 'insufficient_detail'}
              onChange={(event) => {
                const value = event.target.value
                if (!isValidRejectionReason(value)) return
                setPendingRejection((current) =>
                  current ? { ...current, reason: value } : current,
                )
              }}
              className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
            >
              {REJECTION_REASONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
            Admin note
            <textarea
              aria-label="Admin note"
              value={pendingRejection?.note ?? ''}
              onChange={(event) => {
                const note = event.target.value
                setPendingRejection((current) => (current ? { ...current, note } : current))
              }}
              maxLength={500}
              rows={3}
              className="mt-1 w-full resize-y rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
              placeholder="Optional context saved with rejected reports"
            />
          </label>
        </div>
      </ConfirmationModal>
      <ConfirmationModal
        open={pendingMerge !== null}
        title="Merge duplicate reports?"
        message="The primary report is kept; the others are marked as duplicates and removed from active triage."
        confirmLabel="Merge duplicates"
        confirmVariant="primary"
        confirmLoading={merging}
        onConfirm={() => {
          void handleConfirmMerge()
        }}
        onCancel={() => {
          setPendingMerge(null)
        }}
      >
        <label className="mt-4 block text-xs font-semibold uppercase text-[var(--color-text-muted)]">
          Primary report (kept)
          <select
            aria-label="Primary report"
            value={pendingMerge?.primaryId ?? ''}
            onChange={(event) => {
              const value = event.target.value
              setPendingMerge((current) => (current ? { ...current, primaryId: value } : current))
            }}
            className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
          >
            {pendingMerge?.ids.map((id) => {
              const report = reports.find((candidate) => candidate.id === id)
              return (
                <option key={id} value={id}>
                  {report ? `${report.description} · ${report.municipality} · ${id}` : id}
                </option>
              )
            })}
          </select>
        </label>
      </ConfirmationModal>
      <ConfirmationModal
        open={pendingLifecycle !== null}
        title={pendingLifecycle?.kind === 'reopen' ? 'Reopen report?' : 'Close report?'}
        message={
          pendingLifecycle?.kind === 'reopen'
            ? 'Reopening returns the report to active handling. A reason is required.'
            : 'Closing archives a resolved report. You can add an optional closure summary.'
        }
        confirmLabel={pendingLifecycle?.kind === 'reopen' ? 'Reopen report' : 'Close report'}
        confirmVariant={pendingLifecycle?.kind === 'reopen' ? 'primary' : 'danger'}
        confirmLoading={lifecycleBusy}
        onConfirm={() => {
          void handleConfirmLifecycle()
        }}
        onCancel={() => {
          setPendingLifecycle(null)
        }}
      >
        <label className="mt-4 block text-xs font-semibold uppercase text-[var(--color-text-muted)]">
          {pendingLifecycle?.kind === 'reopen' ? 'Reopen reason' : 'Closure summary'}
          <textarea
            aria-label={pendingLifecycle?.kind === 'reopen' ? 'Reopen reason' : 'Closure summary'}
            value={pendingLifecycle?.text ?? ''}
            onChange={(event) => {
              const text = event.target.value
              setPendingLifecycle((current) => (current ? { ...current, text } : current))
            }}
            maxLength={pendingLifecycle?.kind === 'reopen' ? 500 : 2000}
            rows={3}
            className="mt-1 w-full resize-y rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
            placeholder={
              pendingLifecycle?.kind === 'reopen'
                ? 'A reason is required to reopen this report'
                : 'Optional summary saved with the closed report'
            }
          />
        </label>
      </ConfirmationModal>
    </div>
  )
}
