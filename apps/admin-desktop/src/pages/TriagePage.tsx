import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import { CommandHeader } from '../components/CommandHeader'
import { OfflineBanner } from '../components/OfflineBanner'
import { PageSkeleton } from '../components/PageSkeleton'
import { SuccessBanner } from '../components/SuccessBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { TriageQueueTable } from '../components/TriageQueueTable'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { db } from '../app/firebase'
import { callables } from '../services/callables'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { withRetry } from '../utils/withRetry'
import type { Report } from '../types'

const TRIAGE_STATUSES = new Set(['new', 'awaiting_verify', 'verified'])
const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'awaiting_verify', label: 'Awaiting verification' },
  { value: 'verified', label: 'Verified' },
] as const
const SEVERITY_FILTERS = [
  { value: 'all', label: 'All severities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const
const REJECTION_REASONS = [
  { value: 'insufficient_detail', label: 'Insufficient detail' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'obviously_false', label: 'Obviously false' },
  { value: 'test_submission', label: 'Test submission' },
] as const

type RejectionReason = (typeof REJECTION_REASONS)[number]['value']

function actionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message
  return fallback
}

function isTriageReport(report: Report): boolean {
  return TRIAGE_STATUSES.has(report.status)
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

function csvCell(value: string | number): string {
  const text = String(value)
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

export function buildTriageExportCsv(reports: readonly Report[]): string {
  const rows = [
    ['reportId', 'type', 'severity', 'status', 'municipality', 'barangay', 'description', 'createdAt'],
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

export default function TriagePage() {
  const { signOut } = useAuth()
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
  const [rejectionReason, setRejectionReason] = useState<RejectionReason>('insufficient_detail')
  const [adminNote, setAdminNote] = useState('')
  const [lastDataUpdateAt, setLastDataUpdateAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  const reports = useMemo<Report[]>(
    () => reportDocs.map((report) => mapReportDocToReportLoose(report)).filter(isTriageReport),
    [reportDocs],
  )
  const typeOptions = useMemo(
    () => Array.from(new Set(reports.map((report) => report.type))).sort(),
    [reports],
  )
  const filteredReports = useMemo<Report[]>(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase()
    return reports.filter((report) => {
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
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!loading) {
      setLastDataUpdateAt(Date.now())
    }
  }, [loading, reportDocs.length])
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

  const setReportLoading = useCallback((reportId: string, isLoading: boolean) => {
    setLoadingIds((current) => {
      const next = new Set(current)
      if (isLoading) next.add(reportId)
      else next.delete(reportId)
      return next
    })
  }, [])

  const executeVerify = useCallback(
    async (reportId: string) => {
      setReportLoading(reportId, true)
      try {
        await withRetry(() =>
          callables.verifyReport({ reportId, idempotencyKey: generateIdempotencyKey() }),
        )
        setSelectedIds((current) => {
          const next = new Set(current)
          next.delete(reportId)
          return next
        })
      } finally {
        setReportLoading(reportId, false)
      }
    },
    [setReportLoading],
  )

  const executeReject = useCallback(
    async (reportId: string) => {
      setReportLoading(reportId, true)
      const notes = adminNote.trim()
      try {
        await withRetry(() =>
          callables.rejectReport({
            reportId,
            reason: rejectionReason,
            ...(notes ? { notes } : {}),
            idempotencyKey: generateIdempotencyKey(),
          }),
        )
        setSelectedIds((current) => {
          const next = new Set(current)
          next.delete(reportId)
          return next
        })
      } finally {
        setReportLoading(reportId, false)
      }
    },
    [adminNote, rejectionReason, setReportLoading],
  )

  const handleVerify = useCallback(
    async (reportId: string) => {
      const report = sortedReports.find((item) => item.id === reportId)
      setActionError(null)
      setSuccessMessage(null)
      try {
        await executeVerify(reportId)
        setSuccessMessage(report?.status === 'new' ? 'Report sent to review' : 'Report verified')
      } catch (err) {
        setActionError(actionErrorMessage(err, 'Report verification failed'))
      }
    },
    [executeVerify, sortedReports],
  )

  const handleReject = useCallback(
    async (reportId: string) => {
      setActionError(null)
      setSuccessMessage(null)
      try {
        await executeReject(reportId)
        setSuccessMessage('Report rejected')
      } catch (err) {
        setActionError(actionErrorMessage(err, 'Report rejection failed'))
      }
    },
    [executeReject],
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
      const errors: string[] = []
      for (const reportId of eligibleIds) {
        try {
          await executeVerify(reportId)
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
    [sortedReports, executeVerify],
  )

  const handleBulkReject = useCallback(
    async (ids: Set<string>) => {
      const eligibleIds = Array.from(ids).filter((id) => {
        const report = sortedReports.find((r) => r.id === id)
        return report?.status === 'awaiting_verify'
      })
      if (eligibleIds.length === 0) return
      setBulkLoading(true)
      setActionError(null)
      setSuccessMessage(null)
      const errors: string[] = []
      for (const reportId of eligibleIds) {
        try {
          await executeReject(reportId)
        } catch (err) {
          errors.push(actionErrorMessage(err, `Failed to reject ${reportId}`))
        }
      }
      if (errors.length > 0) {
        setActionError(
          `Bulk reject completed with ${String(errors.length)} error(s): ${errors.join('; ')}`,
        )
      } else {
        setSuccessMessage(`${String(eligibleIds.length)} report(s) rejected`)
      }
      setBulkLoading(false)
    },
    [sortedReports, executeReject],
  )

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
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner
        error={error}
        onRetry={() => {
          window.location.reload()
        }}
      />
      <CommandHeader
        title="Admin Triage"
        windowRole="triage"
        onSignOut={() => {
          void signOut()
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
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <section className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                Triage workbench
              </h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Review incoming reports, verify dispatch-ready incidents, and route verified reports
                to the map.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                {STATUS_FILTERS.map((option) => (
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
            <label className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
              Rejection reason
              <select
                value={rejectionReason}
                onChange={(event) => {
                  setRejectionReason(event.target.value as RejectionReason)
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
            <label className="text-xs font-semibold uppercase text-[var(--color-text-muted)] md:col-span-6">
              Admin note
              <textarea
                value={adminNote}
                onChange={(event) => {
                  setAdminNote(event.target.value)
                }}
                maxLength={500}
                rows={2}
                className="mt-1 w-full resize-y rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]"
                placeholder="Optional context saved with rejected reports"
              />
            </label>
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
              }}
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
                void handleReject(reportId)
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
                void handleBulkReject(ids)
              }}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
