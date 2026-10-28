import { useEffect, useState, type ReactNode } from 'react'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'
import type { Report } from '../types'

export interface AssignmentReport {
  report: Report
  municipalityId?: string
}

const SLA_COUNTDOWN_STATUSES = new Set(['pending', 'accepted'])

const RESPONDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  acknowledged: 'Acknowledged',
  en_route: 'En route',
  on_scene: 'On scene',
}

function responderStatusLabel(status: string): string {
  return RESPONDER_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
}

function formatSlaDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  if (totalSeconds < 60) return `${String(totalSeconds)}s`

  const totalMinutes = Math.ceil(totalSeconds / 60)
  if (totalMinutes < 60) return `${String(totalMinutes)}m`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${String(hours)}h ${String(minutes)}m` : `${String(hours)}h`
}

function formatResolvedAt(resolvedAt: number | undefined): string {
  if (resolvedAt === undefined) return 'Resolved time not recorded'

  return `Resolved ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(resolvedAt))}`
}

function SlaCountdown({ deadlineAt }: { deadlineAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  const isOverdue = now > deadlineAt
  const duration = formatSlaDuration(isOverdue ? now - deadlineAt : deadlineAt - now)
  const label = isOverdue ? `SLA overdue by ${duration}` : `SLA due in ${duration}`

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [])

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-semibold ${
        isOverdue
          ? 'border-[var(--color-danger)]/50 bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
          : 'border-[var(--color-warning)]/50 bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
      }`}
    >
      <span className="font-mono">SLA</span>{' '}
      {isOverdue ? `Overdue by ${duration}` : `${duration} left`}
    </span>
  )
}

// Shared card frame: heading, subtitle, count badge, then either an empty note or the body.
function QueueSection({
  label,
  title,
  subtitle,
  badge,
  badgeClassName = 'border-white/10 text-[var(--color-text-secondary)]',
  emptyText,
  children,
}: {
  label: string
  title: string
  subtitle: string
  badge: string
  badgeClassName?: string
  emptyText?: string
  children: ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
        </div>
        <span className={`rounded border px-2 py-1 text-xs ${badgeClassName}`}>{badge}</span>
      </div>
      {emptyText ? (
        <p className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          {emptyText}
        </p>
      ) : (
        children
      )}
    </section>
  )
}

function ResponderHeading({ row }: { row: DispatchLifecycleRow }) {
  return (
    <div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {row.responderName || 'Responder'}
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        {row.responderAgency || 'Agency pending'} · {row.reportId}
      </p>
    </div>
  )
}

export function ResponderStatusSection({ rows }: { rows: readonly DispatchLifecycleRow[] }) {
  return (
    <QueueSection
      label="Responder status queue"
      title="Responder Status"
      subtitle="Active responder progress pending through scene arrival."
      badge={`${String(rows.length)} active`}
      {...(rows.length === 0
        ? { emptyText: 'No responder status updates waiting for review.' }
        : {})}
    >
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article
            key={row.dispatchId}
            data-dispatch-id={row.dispatchId}
            className="rounded border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <ResponderHeading row={row} />
              <span className="rounded bg-white/10 px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                {responderStatusLabel(row.status)}
              </span>
            </div>
            {SLA_COUNTDOWN_STATUSES.has(row.status) && row.deadlineAt > 0 ? (
              <div className="mt-3">
                <SlaCountdown deadlineAt={row.deadlineAt} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </QueueSection>
  )
}

export function AssignmentQueueSection({
  assignments,
  responders,
  selections,
  assigningReportId,
  onSelect,
  onAssign,
}: {
  assignments: readonly AssignmentReport[]
  responders: readonly ResponderFleetMember[]
  selections: Record<string, string>
  assigningReportId: string | null
  onSelect: (reportId: string, responderUid: string) => void
  onAssign: (reportId: string) => void
}) {
  // Prefer responders in the report's municipality; fall back to everyone if none match.
  const candidatesFor = (assignment: AssignmentReport) => {
    if (!assignment.municipalityId) return responders
    const scoped = responders.filter((r) => r.municipalityId === assignment.municipalityId)
    return scoped.length > 0 ? scoped : responders
  }

  return (
    <QueueSection
      label="Responder assignment queue"
      title="Responder Assignment"
      subtitle="Verified reports waiting for first dispatch."
      badge={`${String(assignments.length)} waiting`}
      {...(assignments.length === 0
        ? { emptyText: 'No verified reports waiting for responder assignment.' }
        : {})}
    >
      <div className="grid gap-3 xl:grid-cols-2">
        {assignments.map((assignment) => {
          const { report } = assignment
          const candidates = candidatesFor(assignment)
          const selectedUid = selections[report.id] ?? ''
          const isAssigning = assigningReportId === report.id
          return (
            <article key={report.id} className="rounded border border-white/10 bg-white/[0.03] p-3">
              <div className="mb-3">
                <p className="text-xs uppercase text-[var(--color-text-muted)]">
                  {report.municipality}
                  {report.barangay ? ` / ${report.barangay}` : ''}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                  {report.description || `Report ${report.id}`}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {report.type} · {report.severity}
                </p>
              </div>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`assignment-responder-${report.id}`}>
                  Responder for {report.id}
                </label>
                <select
                  id={`assignment-responder-${report.id}`}
                  value={selectedUid}
                  onChange={(event) => {
                    onSelect(report.id, event.target.value)
                  }}
                  className="min-w-0 flex-1 rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="">
                    {candidates.length === 0 ? 'No responders available' : 'Choose responder'}
                  </option>
                  {candidates.map((responder) => (
                    <option key={responder.uid} value={responder.uid}>
                      {responder.displayName || responder.uid}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedUid || isAssigning}
                  onClick={() => {
                    onAssign(report.id)
                  }}
                  className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAssigning ? 'Assigning...' : 'Assign responder'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </QueueSection>
  )
}

export function ResolvedDispatchesSection({ rows }: { rows: readonly DispatchLifecycleRow[] }) {
  if (rows.length === 0) return null
  return (
    <QueueSection
      label="Recently resolved dispatches"
      title="Recently Resolved"
      subtitle="Closed responder work from the current dispatch window."
      badge={`${String(rows.length)} closed`}
      badgeClassName="border-[var(--color-success)]/30 text-[var(--color-success)]"
    >
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const summary = row.resolutionSummary?.trim()
          return (
            <article
              key={row.dispatchId}
              className="rounded border border-white/10 bg-white/[0.03] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <ResponderHeading row={row} />
                <span className="rounded bg-[var(--color-success)]/15 px-2 py-1 text-xs font-semibold text-[var(--color-success)]">
                  Resolved
                </span>
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
                {formatResolvedAt(row.resolvedAt)}
              </p>
              <p className="mt-2 rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                {summary && summary.length > 0 ? summary : 'No resolution summary recorded.'}
              </p>
            </article>
          )
        })}
      </div>
    </QueueSection>
  )
}
