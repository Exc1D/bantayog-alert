import { ConfirmationModal } from './ConfirmationModal'
import {
  REJECTION_REASONS,
  isValidRejectionReason,
  type RejectionReason,
} from '../constants/report'
import type { Report } from '../types'

const FIELD_CLASS =
  'mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm normal-case text-[var(--color-text-primary)]'
const LABEL_CLASS = 'text-xs font-semibold uppercase text-[var(--color-text-muted)]'

export interface PendingRejection {
  reportIds: string[]
  reason: RejectionReason
  note: string
  scope: 'single' | 'bulk'
}

export interface PendingMerge {
  primaryId: string
  ids: string[]
}

export interface PendingLifecycle {
  kind: 'close' | 'reopen'
  reportId: string
  text: string
}

function reportCountLabel(count: number): string {
  return `${String(count)} report${count === 1 ? '' : 's'}`
}

export function RejectDialog({
  pending,
  onChange,
  onConfirm,
  onCancel,
}: {
  pending: PendingRejection | null
  onChange: (patch: Partial<Pick<PendingRejection, 'reason' | 'note'>>) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const countLabel = reportCountLabel(pending?.reportIds.length ?? 0)
  const isBulk = pending?.scope === 'bulk'
  return (
    <ConfirmationModal
      open={pending !== null}
      title={isBulk ? 'Reject selected reports?' : 'Reject report?'}
      message="Rejecting keeps the report out of active triage while preserving the audit trail."
      confirmLabel={isBulk ? `Reject ${countLabel}` : 'Reject report'}
      confirmVariant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="mt-4 grid gap-3 rounded border border-white/10 bg-white/[0.03] p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[var(--color-text-secondary)]">Reports</span>
          <span className="font-medium text-[var(--color-text-primary)]">{countLabel}</span>
        </div>
        <label className={LABEL_CLASS}>
          Rejection reason
          <select
            aria-label="Rejection reason"
            value={pending?.reason ?? 'insufficient_detail'}
            onChange={(event) => {
              const value = event.target.value
              if (isValidRejectionReason(value)) onChange({ reason: value })
            }}
            className={FIELD_CLASS}
          >
            {REJECTION_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Admin note
          <textarea
            aria-label="Admin note"
            value={pending?.note ?? ''}
            onChange={(event) => {
              onChange({ note: event.target.value })
            }}
            maxLength={500}
            rows={3}
            className={`${FIELD_CLASS} resize-y`}
            placeholder="Optional context saved with rejected reports"
          />
        </label>
      </div>
    </ConfirmationModal>
  )
}

export function MergeDialog({
  pending,
  reports,
  merging,
  onPrimaryChange,
  onConfirm,
  onCancel,
}: {
  pending: PendingMerge | null
  reports: readonly Report[]
  merging: boolean
  onPrimaryChange: (primaryId: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <ConfirmationModal
      open={pending !== null}
      title="Merge duplicate reports?"
      message="The primary report is kept; the others are marked as duplicates and removed from active triage."
      confirmLabel="Merge duplicates"
      confirmVariant="primary"
      confirmLoading={merging}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <label className={`mt-4 block ${LABEL_CLASS}`}>
        Primary report (kept)
        <select
          aria-label="Primary report"
          value={pending?.primaryId ?? ''}
          onChange={(event) => {
            onPrimaryChange(event.target.value)
          }}
          className={FIELD_CLASS}
        >
          {pending?.ids.map((id) => {
            const report = reports.find((candidate) => candidate.id === id)
            return (
              <option key={id} value={id}>
                {report ? `${report.description} · ${report.municipality} · ${id}` : id}
              </option>
            )
          })}
        </select>
      </label>
    </ConfirmationModal>
  )
}

export function LifecycleDialog({
  pending,
  busy,
  onTextChange,
  onConfirm,
  onCancel,
}: {
  pending: PendingLifecycle | null
  busy: boolean
  onTextChange: (text: string) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const isReopen = pending?.kind === 'reopen'
  const fieldLabel = isReopen ? 'Reopen reason' : 'Closure summary'
  return (
    <ConfirmationModal
      open={pending !== null}
      title={isReopen ? 'Reopen report?' : 'Close report?'}
      message={
        isReopen
          ? 'Reopening returns the report to active handling. A reason is required.'
          : 'Closing archives a resolved report. You can add an optional closure summary.'
      }
      confirmLabel={isReopen ? 'Reopen report' : 'Close report'}
      confirmVariant={isReopen ? 'primary' : 'danger'}
      confirmLoading={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <label className={`mt-4 block ${LABEL_CLASS}`}>
        {fieldLabel}
        <textarea
          aria-label={fieldLabel}
          value={pending?.text ?? ''}
          onChange={(event) => {
            onTextChange(event.target.value)
          }}
          maxLength={isReopen ? 500 : 2000}
          rows={3}
          className={`${FIELD_CLASS} resize-y`}
          placeholder={
            isReopen
              ? 'A reason is required to reopen this report'
              : 'Optional summary saved with the closed report'
          }
        />
      </label>
    </ConfirmationModal>
  )
}
