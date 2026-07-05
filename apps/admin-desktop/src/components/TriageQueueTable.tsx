import { Check, X, Send, Archive, RotateCcw } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'
import { ReportTypeIcon } from './ReportTypeIcon'
import { EmptyTriageState } from './EmptyTriageState'
import { formatRelativeTime } from '../utils/format-time'
import type { Report } from '../types'

interface Props {
  reports: Report[]
  selectedIds: Set<string>
  loadingIds?: Set<string>
  bulkLoading?: boolean
  bulkVerifyIds?: Set<string>
  bulkRejectIds?: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onVerify: (id: string) => void
  onReject: (id: string) => void
  onDispatch: (id: string) => void
  onRowClick: (report: Report) => void
  onBulkVerify?: (ids: Set<string>) => void | Promise<void>
  onBulkReject?: (ids: Set<string>) => void | Promise<void>
  onClose?: (id: string) => void
  onReopen?: (id: string) => void
}

function actionFlags(status: string) {
  const canVerify = status === 'new' || status === 'awaiting_verify'
  const canReject = status === 'awaiting_verify'
  // Dispatch is owned by the Map/Dispatch surfaces; verified triage rows route
  // there instead of dispatching directly from this table.
  const canDispatch = false
  const canClose = status === 'resolved'
  const canReopen = status === 'closed'
  return { canVerify, canReject, canDispatch, canClose, canReopen }
}

export function TriageQueueTable({
  reports,
  selectedIds,
  loadingIds = new Set(),
  bulkLoading = false,
  bulkVerifyIds = new Set(),
  bulkRejectIds = new Set(),
  onToggleSelect,
  onSelectAll,
  onVerify,
  onReject,
  onDispatch,
  onRowClick,
  onBulkVerify,
  onBulkReject,
  onClose,
  onReopen,
}: Props) {
  const allSelected = reports.length > 0 && reports.every((r) => selectedIds.has(r.id))

  if (reports.length === 0) {
    return <EmptyTriageState />
  }

  const hasVerifyTargets = bulkVerifyIds.size > 0
  const hasRejectTargets = bulkRejectIds.size > 0

  return (
    <div>
      {selectedIds.size > 0 && (
        <div
          data-testid="bulk-action-bar"
          className="sticky top-0 z-20 mb-2 flex items-center gap-2 border-b border-white/10 bg-[var(--color-surface-elevated)] px-4 py-2"
        >
          <span className="text-sm text-[var(--color-text-secondary)]">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            className="rounded bg-[var(--color-success)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              void onBulkVerify?.(selectedIds)
            }}
            disabled={!hasVerifyTargets || bulkLoading}
          >
            {bulkLoading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              'Verify Selected'
            )}
          </button>
          <button
            type="button"
            className="rounded bg-[var(--color-danger)] px-3 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              void onBulkReject?.(selectedIds)
            }}
            disabled={!hasRejectTargets || bulkLoading}
          >
            {bulkLoading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              'Reject Selected'
            )}
          </button>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-white/10 bg-[var(--color-surface-elevated)] text-xs uppercase text-[var(--color-text-muted)]">
          <tr>
            <th className="px-4 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-4 py-2">Time</th>
            <th className="px-4 py-2">Summary</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Severity</th>
            <th className="px-4 py-2">Municipality</th>
            <th className="px-4 py-2">Barangay</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const actions = actionFlags(report.status)
            return (
              <tr
                key={report.id}
                data-testid={`report-row-${report.id}`}
                className="cursor-pointer border-b border-white/5 hover:bg-white/5"
                onClick={() => {
                  onRowClick(report)
                }}
              >
                <td
                  className="px-4 py-3"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(report.id)}
                    onChange={() => {
                      onToggleSelect(report.id)
                    }}
                    aria-label={`Select report ${report.id}`}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)]">
                  {formatRelativeTime(report.createdAt)}
                </td>
                <td className="max-w-[24rem] px-4 py-3 text-[var(--color-text-primary)]">
                  <p className="truncate">
                    {typeof report.description === 'string' && report.description.trim()
                      ? report.description.trim()
                      : 'Report details pending'}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <ReportTypeIcon type={report.type} />
                </td>
                <td className="px-4 py-3">
                  <SeverityBadge severity={report.severity} />
                </td>
                <td className="px-4 py-3 text-[var(--color-text-primary)]">
                  {report.municipality}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{report.barangay}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {actions.canVerify && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onVerify(report.id)
                        }}
                        disabled={loadingIds.has(report.id)}
                        className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-[var(--color-success)] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Verify"
                      >
                        {loadingIds.has(report.id) ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        <span>Verify</span>
                      </button>
                    )}
                    {actions.canReject && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReject(report.id)
                        }}
                        disabled={loadingIds.has(report.id)}
                        className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-[var(--color-danger)] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Reject"
                      >
                        {loadingIds.has(report.id) ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        <span>Reject</span>
                      </button>
                    )}
                    {actions.canDispatch && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDispatch(report.id)
                        }}
                        disabled={loadingIds.has(report.id)}
                        className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-[var(--color-info)] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Dispatch"
                      >
                        {loadingIds.has(report.id) ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span>Dispatch</span>
                      </button>
                    )}
                    {actions.canClose && onClose && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onClose(report.id)
                        }}
                        disabled={loadingIds.has(report.id)}
                        className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Close report"
                      >
                        {loadingIds.has(report.id) ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                        <span>Close</span>
                      </button>
                    )}
                    {actions.canReopen && onReopen && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReopen(report.id)
                        }}
                        disabled={loadingIds.has(report.id)}
                        className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-[var(--color-warning)] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Reopen report"
                      >
                        {loadingIds.has(report.id) ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        <span>Reopen</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
