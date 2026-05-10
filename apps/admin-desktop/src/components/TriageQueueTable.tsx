import { Check, X, Send } from 'lucide-react'
import { SeverityBadge } from './SeverityBadge'
import { ReportTypeIcon } from './ReportTypeIcon'
import type { Report } from '../types'

interface Props {
  reports: Report[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onVerify: (id: string) => void
  onReject: (id: string) => void
  onDispatch: (id: string) => void
  onRowClick: (report: Report) => void
}

export function TriageQueueTable({
  reports,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onVerify,
  onReject,
  onDispatch,
  onRowClick,
}: Props) {
  const allSelected = reports.length > 0 && reports.every((r) => selectedIds.has(r.id))

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
        <Check
          className="mb-2 h-8 w-8 text-[var(--color-success)]"
          role="status"
          aria-label="All reports triaged"
        />
        <p className="text-lg font-medium text-[var(--color-text-primary)]">All Caught Up</p>
        <p>No reports pending verification</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {selectedIds.size > 0 && (
        <div className="mb-2 flex items-center gap-2 px-4">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {selectedIds.size} selected
          </span>
          <button
            className="rounded bg-[var(--color-success)] px-3 py-1 text-xs text-white hover:opacity-90"
            onClick={() => {
              /* bulk verify */
            }}
          >
            Verify Selected
          </button>
          <button
            className="rounded bg-[var(--color-danger)] px-3 py-1 text-xs text-white hover:opacity-90"
            onClick={() => {
              /* bulk reject */
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
                {report.createdAt}
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
                    className="rounded p-1 text-[var(--color-success)] hover:bg-white/10"
                    aria-label="Verify"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onReject(report.id)
                    }}
                    className="rounded p-1 text-[var(--color-danger)] hover:bg-white/10"
                    aria-label="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDispatch(report.id)
                    }}
                    className="rounded p-1 text-[#3b82f6] hover:bg-white/10"
                    aria-label="Dispatch"
                  >
                    <Send className="h-4 w-4" />
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
