import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'
import { FcmStatusIcon } from './FcmStatusIcon'
import { DispatchTimeline } from './DispatchTimeline'

interface Props {
  rows: DispatchLifecycleRow[]
}

const STATUS_BADGE_MAP: Record<string, { label: string; bgColor: string; textColor: string }> = {
  pending: { label: 'Pending', bgColor: 'bg-amber-100', textColor: 'text-amber-800' },
  accepted: { label: 'Accepted', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  declined: { label: 'Declined', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  needs_admin: { label: 'Needs Admin', bgColor: 'bg-red-100', textColor: 'text-red-800' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE_MAP[status] ?? {
    label: status,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
  }
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.textColor}`}
    >
      {cfg.label}
    </span>
  )
}

interface DispatchRowProps {
  row: DispatchLifecycleRow
  expanded: boolean
  onToggle: (id: string) => void
}

function DispatchRow({ row, expanded, onToggle }: DispatchRowProps) {
  return (
    <>
      <tr
        className="border-b cursor-pointer hover:bg-gray-50"
        onClick={() => {
          onToggle(row.dispatchId)
        }}
      >
        <td className="px-3 py-2">{row.reportId.slice(0, 8)}</td>
        <td className="px-3 py-2">
          <div>{row.responderName}</div>
          <div className="text-xs text-gray-500">{row.responderAgency}</div>
        </td>
        <td className="px-3 py-2">
          <StatusBadge status={row.status} />
        </td>
        <td className="px-3 py-2">
          <FcmStatusIcon result={row.fcmResult} warnings={row.fcmWarnings} />
        </td>
        <td className="px-3 py-2">{row.escalationCount}</td>
        <td className="px-3 py-2">
          <button
            type="button"
            aria-label={expanded ? 'Collapse row' : 'Expand row'}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(row.dispatchId)
            }}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-3 py-2 bg-gray-50">
            <DispatchTimeline events={row.timeline} />
          </td>
        </tr>
      )}
    </>
  )
}

export function DispatchLifecycleTable({ rows }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpandedRow = useCallback((id: string) => {
    setExpandedIds((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        return next
      }
      return new Set([...prev, id])
    })
  }, [])

  if (rows.length === 0) {
    return <p>No active dispatches</p>
  }

  return (
    <table className="w-full text-sm" role="table">
      <thead>
        <tr className="border-b text-left">
          <th className="px-3 py-2">Report</th>
          <th className="px-3 py-2">Responder</th>
          <th className="px-3 py-2">Status</th>
          <th className="px-3 py-2">FCM</th>
          <th className="px-3 py-2">Escalations</th>
          <th className="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <DispatchRow
            key={row.dispatchId}
            row={row}
            expanded={expandedIds.has(row.dispatchId)}
            onToggle={toggleExpandedRow}
          />
        ))}
      </tbody>
    </table>
  )
}
