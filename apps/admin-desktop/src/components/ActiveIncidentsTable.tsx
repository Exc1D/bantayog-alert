import { SeverityBadge } from './SeverityBadge'
import { ReportTypeIcon } from './ReportTypeIcon'
import { formatRelativeTime } from '../utils/format-time'
import type { Report } from '../types'

const TRACKING_STATUS_LABELS: Record<string, string> = {
  verified: 'Verified',
  assigned: 'Assigned',
  acknowledged: 'Acknowledged',
  en_route: 'En Route',
  on_scene: 'On Scene',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  cancelled_false_report: 'Cancelled (False)',
  merged_as_duplicate: 'Merged',
}

function statusStyle(status: string): string {
  const colors: Record<string, string> = {
    verified: 'bg-blue-500/10 text-blue-400',
    assigned: 'bg-amber-500/10 text-amber-400',
    acknowledged: 'bg-amber-500/10 text-amber-400',
    en_route: 'bg-cyan-500/10 text-cyan-400',
    on_scene: 'bg-purple-500/10 text-purple-400',
    resolved: 'bg-green-500/10 text-green-400',
    closed: 'bg-gray-500/10 text-gray-400',
    reopened: 'bg-orange-500/10 text-orange-400',
    rejected: 'bg-red-500/10 text-red-400',
    cancelled: 'bg-gray-500/10 text-gray-400',
  }
  return colors[status] ?? 'bg-gray-500/10 text-gray-400'
}

interface Props {
  reports: Report[]
  onRowClick: (report: Report) => void
}

export function ActiveIncidentsTable({ reports, onRowClick }: Props) {
  if (reports.length === 0) {
    return (
      <div
        role="status"
        className="rounded-lg border border-white/5 bg-[var(--color-surface-elevated)] px-4 py-8 text-center text-sm text-white/40"
      >
        No active incidents to track
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-white/10 bg-[var(--color-surface-elevated)] text-xs uppercase text-[var(--color-text-muted)]">
          <tr>
            <th className="px-4 py-2">Time</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Severity</th>
            <th className="px-4 py-2">Municipality</th>
            <th className="px-4 py-2">Barangay</th>
            <th className="px-4 py-2">Status</th>
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
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(report.status)}`}
                >
                  {TRACKING_STATUS_LABELS[report.status] ?? report.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
