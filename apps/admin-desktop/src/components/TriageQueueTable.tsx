import { Check, X, Send } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'
import { ReportTypeIcon } from './ReportTypeIcon'
import { EmptyTriageState } from './EmptyTriageState'
import type { Report } from '../types'

interface Props {
  reports: Report[]
  selectedIds: Set<string>
  loadingIds?: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onVerify: (id: string) => void
  onReject: (id: string) => void
  onDispatch: (id: string) => void
  onRowClick: (report: Report) => void
  onBulkVerify?: (ids: Set<string>) => void
  onBulkReject?: (ids: Set<string>) => void
}

function formatRelativeTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (diffSec < 60) return `${String(diffSec)}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${String(diffMin)}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${String(diffHr)}h ago`
  return `${String(Math.floor(diffHr / 24))}d ago`
}

export function TriageQueueTable({
  reports,
  selectedIds,
  loadingIds = new Set(),
  onToggleSelect,
  onSelectAll,
  onVerify,
  onReject,
  onDispatch,
  onRowClick,
  onBulkVerify,
  onBulkReject,
}: Props) {
  const allSelected = reports.length > 0 && reports.every((r) => selectedIds.has(r.id))

  if (reports.length === 0) {
    return <EmptyTriageState />
  }

  return (
    <div className="overflow-x-auto">
      {selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-2 px-4">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            className="rounded bg-[var(--color-success)] px-3 py-1 text-xs text-white hover:opacity-90"
            onClick={() => {
              onBulkVerify?.(selectedIds)
            }}
          >
            Verify Selected
          </button>
          <button
            type="button"
            className="rounded bg-[var(--color-danger)] px-3 py-1 text-xs text-white hover:opacity-90"
            onClick={() => {
              onBulkReject?.(selectedIds)
            }}
          >
            Reject Selected
          </button>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase text-[var(--color-text-muted)]">
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
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Severity</th>
            <th className="px-4 py-2">Municipality</th>
            <th className="px-4 py-2">Barangay</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr
              key={report.id}
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
              <td className="px-4 py-3">
                <ReportTypeIcon type={report.type} />
              </td>
              <td className="px-4 py-3">
                <SeverityBadge severity={report.severity} />
              </td>
              <td className="px-4 py-3 text-[var(--color-text-primary)]">{report.municipality}</td>
              <td className="px-4 py-3 text-[var(--color-text-secondary)]">{report.barangay}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onVerify(report.id)
                    }}
                    disabled={loadingIds.has(report.id)}
                    className="rounded p-2 text-[var(--color-success)] hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Verify"
                  >
                    {loadingIds.has(report.id) ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onReject(report.id)
                    }}
                    disabled={loadingIds.has(report.id)}
                    className="rounded p-2 text-[var(--color-danger)] hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Reject"
                  >
                    {loadingIds.has(report.id) ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDispatch(report.id)
                    }}
                    disabled={loadingIds.has(report.id)}
                    className="rounded p-2 text-[var(--color-info)] hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Dispatch"
                  >
                    {loadingIds.has(report.id) ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
