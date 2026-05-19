import { useCallback, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { List } from 'react-window'
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

const ROW_HEIGHT = 40

interface RowRendererProps {
  index: number
  style: React.CSSProperties
  ariaAttributes: {
    'aria-posinset': number
    'aria-setsize': number
    role: 'listitem'
  }
  rows: DispatchLifecycleRow[]
  expandedIds: Set<string>
  onToggle: (id: string) => void
}

function RowRenderer({ index, style, rows, expandedIds, onToggle }: RowRendererProps) {
  const row = rows[index]
  if (!row) return null
  const expanded = expandedIds.has(row.dispatchId)

  return (
    <div style={style}>
      <div className="border-b">
        <div
          className="flex cursor-pointer items-center px-3 py-2 hover:bg-gray-50"
          role="row"
          tabIndex={0}
          onClick={() => {
            onToggle(row.dispatchId)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle(row.dispatchId)
            }
          }}
        >
          <span className="w-28 truncate">{row.reportId.slice(0, 8)}</span>
          <span className="flex-1">
            <div>{row.responderName}</div>
            <div className="text-xs text-gray-500">{row.responderAgency}</div>
          </span>
          <span className="w-24">
            <StatusBadge status={row.status} />
          </span>
          <span className="w-12">
            <FcmStatusIcon result={row.fcmResult} />
          </span>
          <span className="w-16 text-center">{row.escalationCount}</span>
          <button
            type="button"
            className="w-8"
            aria-label={expanded ? 'Collapse row' : 'Expand row'}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(row.dispatchId)
            }}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
        {expanded && (
          <div className="bg-gray-50 px-3 py-2">
            <DispatchTimeline events={row.timeline} />
          </div>
        )}
      </div>
    </div>
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
    <div>
      <div className="mb-2 flex text-sm font-medium text-left">
        <span className="w-28 px-3 py-2">Report</span>
        <span className="flex-1 px-3 py-2">Responder</span>
        <span className="w-24 px-3 py-2">Status</span>
        <span className="w-12 px-3 py-2">FCM</span>
        <span className="w-16 px-3 py-2 text-center">Escalations</span>
        <span className="w-8 px-3 py-2"></span>
      </div>
      <List
        style={{ height: Math.min(rows.length * ROW_HEIGHT, 600), width: '100%' }}
        rowCount={rows.length}
        rowHeight={ROW_HEIGHT}
        // react-window v2 types expect forbidden keys as `never` in rowProps
        // @ts-expect-error rowProps excludes index/style/ariaAttributes at runtime
        rowProps={{
          rows,
          expandedIds,
          onToggle: toggleExpandedRow,
        }}
        rowComponent={RowRenderer}
      />
    </div>
  )
}
