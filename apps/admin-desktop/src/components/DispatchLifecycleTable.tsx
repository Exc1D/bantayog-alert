import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Search, Info } from 'lucide-react'
import type { DispatchLifecycleRow, DispatchEvent } from '../hooks/useDispatchLifecycle'
import { FcmStatusIcon } from './FcmStatusIcon'
import { DispatchTimeline } from './DispatchTimeline'
import { Tooltip } from './Tooltip'

interface Props {
  rows: DispatchLifecycleRow[]
  highlightDispatchId?: string | null
  onCancelDispatch?: (dispatchId: string) => void
}

// Matches CANCELLABLE_FROM_STATES in functions/src/domains/dispatches/cancel-dispatch.ts
const CANCELLABLE_STATUSES = new Set([
  'pending',
  'accepted',
  'acknowledged',
  'en_route',
  'on_scene',
])

const STATUS_BADGE_MAP: Record<string, { label: string; style: React.CSSProperties }> = {
  pending: {
    label: 'Pending',
    style: { color: 'var(--color-warning)', backgroundColor: 'rgba(167,52,0,0.12)' },
  },
  accepted: {
    label: 'Accepted',
    style: { color: 'var(--color-info)', backgroundColor: 'rgba(59,130,246,0.12)' },
  },
  declined: {
    label: 'Declined',
    style: { color: 'var(--color-danger)', backgroundColor: 'rgba(153,27,27,0.12)' },
  },
  needs_admin: {
    label: 'Needs Admin',
    style: { color: 'var(--color-danger)', backgroundColor: 'rgba(153,27,27,0.12)' },
  },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE_MAP[status] ?? {
    label: status,
    style: { color: 'var(--color-text-muted)', backgroundColor: 'rgba(255,255,255,0.06)' },
  }
  return (
    <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium" style={cfg.style}>
      {cfg.label}
    </span>
  )
}

interface RowRendererProps {
  row: DispatchLifecycleRow
  expandedId: string | null
  onToggle: (id: string) => void
  highlightDispatchId?: string | null
}

function RowRenderer({ row, expandedId, onToggle, highlightDispatchId }: RowRendererProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const expanded = expandedId === row.dispatchId
  const isHighlighted = highlightDispatchId === row.dispatchId

  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isHighlighted])

  return (
    <div ref={rowRef}>
      <div
        className={`flex cursor-pointer items-center border-b border-white/5 px-3 py-2 hover:bg-white/[0.03] ${expanded ? 'bg-white/[0.05]' : ''} ${isHighlighted ? 'ring-2 ring-[var(--color-carto-blue)] ring-inset' : ''}`}
        role="row"
        tabIndex={0}
        data-dispatch-id={row.dispatchId}
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
        <span
          className="w-28 truncate font-mono text-[var(--color-text-secondary)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {row.reportId.slice(0, 8)}
        </span>
        <span className="flex-1">
          <div className="text-[var(--color-text-primary)]">{row.responderName}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{row.responderAgency}</div>
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
    </div>
  )
}

export function DispatchLifecycleTable({ rows, highlightDispatchId, onCancelDispatch }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const toggleRow = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  // Auto-expand highlighted row on mount / param change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (highlightDispatchId) {
      setExpandedId(highlightDispatchId)
    }
  }, [highlightDispatchId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.reportId.toLowerCase().includes(q) ||
        r.responderName.toLowerCase().includes(q) ||
        r.responderAgency.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q),
    )
  }, [rows, query])

  const expandedRow = expandedId ? filteredRows.find((r) => r.dispatchId === expandedId) : null
  const expandedTimeline: DispatchEvent[] = expandedRow?.timeline ?? []

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Dispatch Lifecycle
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              placeholder="Search dispatches…"
              className="rounded border border-white/10 bg-white/5 py-1.5 pl-7 pr-3 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-carto-blue)]"
              aria-label="Search dispatches"
            />
          </div>
          <Tooltip content="FCM = Firebase Cloud Messaging (push notification delivery)">
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              FCM
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="mb-2 flex text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            <span className="w-28 px-3 py-2">Report</span>
            <span className="flex-1 px-3 py-2">Responder</span>
            <span className="w-24 px-3 py-2">Status</span>
            <span className="w-12 px-3 py-2">FCM</span>
            <span className="w-16 px-3 py-2 text-center">Escalations</span>
            <span className="w-8 px-3 py-2"></span>
          </div>

          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-text-muted)]/20 bg-[var(--color-surface-elevated)] py-12 text-center">
              <Search className="mb-3 h-8 w-8 text-[var(--color-text-muted)]" aria-hidden="true" />
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                {query ? 'No matching dispatches' : 'No active dispatches'}
              </h3>
              <p className="mt-1 max-w-xs text-xs text-[var(--color-text-secondary)]">
                {query
                  ? 'Try adjusting your search terms.'
                  : 'Dispatches appear here when reports are assigned to responders.'}
              </p>
            </div>
          ) : (
            // ponytail: plain scroll list; re-virtualize if pilot dispatch volume ever makes this slow
            <div role="list" className="overflow-y-auto" style={{ maxHeight: 600 }}>
              {filteredRows.map((row) => (
                <RowRenderer
                  key={row.dispatchId}
                  row={row}
                  expandedId={expandedId}
                  onToggle={toggleRow}
                  highlightDispatchId={highlightDispatchId ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {expandedRow && (
        <div className="mt-2 rounded-md border border-white/10 bg-[var(--color-surface-elevated)] p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Timeline — {expandedRow.reportId.slice(0, 8)}
            </span>
            {onCancelDispatch && CANCELLABLE_STATUSES.has(expandedRow.status) && (
              <button
                type="button"
                onClick={() => {
                  onCancelDispatch(expandedRow.dispatchId)
                }}
                className="rounded border border-[var(--color-danger)]/40 px-2 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]/50"
              >
                Cancel dispatch
              </button>
            )}
          </div>
          <DispatchTimeline events={expandedTimeline} />
        </div>
      )}
    </div>
  )
}
