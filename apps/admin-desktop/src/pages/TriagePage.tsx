import { useCallback, useMemo, useState } from 'react'
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

  const reports = useMemo<Report[]>(
    () => reportDocs.map((report) => mapReportDocToReportLoose(report)).filter(isTriageReport),
    [reportDocs],
  )
  const sortedReports = useMemo<Report[]>(() => [...reports].sort(sortTriageReports), [reports])

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
      try {
        await withRetry(() =>
          callables.rejectReport({
            reportId,
            reason: 'insufficient_detail',
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
    [setReportLoading],
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
            <div className="rounded border border-white/10 bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
              {sortedReports.length} report{sortedReports.length === 1 ? '' : 's'} in queue
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
