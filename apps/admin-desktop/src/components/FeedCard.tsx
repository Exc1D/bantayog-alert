import { Tooltip } from './Tooltip'
import { PhotoGallery } from './PhotoGallery'
import type { Report } from '../types'

interface MediaItem {
  uploadId: string
  url: string
}

interface Props {
  raw: Record<string, unknown>
  report: Report
  draft: string
  canPublish: boolean
  canUnpublish: boolean
  isPending: boolean
  isPublishing: boolean
  mediaUrls: MediaItem[]
  onVerify: () => void
  onPublish: () => void
  onUnpublish: () => void
  onDraftChange: (value: string) => void
  onError: (message: string) => void
}

function visibilityLabel(doc: Record<string, unknown>, report: Report): string {
  if (doc.visibilityClass === 'public_alertable') return 'Published'
  if (report.status === 'awaiting_verify') return 'Pending publication'
  if (report.status === 'verified') return 'Unpublished'
  return 'Intake'
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-info)',
}

const STATUS_BADGE_STYLES: Record<string, { color: string; bg: string }> = {
  Published: { color: 'var(--color-success)', bg: 'rgba(34,197,94,0.12)' },
  'Pending publication': { color: 'var(--color-warning)', bg: 'rgba(167,52,0,0.12)' },
  Unpublished: { color: 'var(--color-text-muted)', bg: 'rgba(255,255,255,0.06)' },
  Intake: { color: 'var(--color-info)', bg: 'rgba(59,130,246,0.12)' },
}

export function FeedCard({
  raw,
  report,
  draft,
  canPublish,
  canUnpublish,
  isPending,
  isPublishing,
  mediaUrls,
  onVerify,
  onPublish,
  onUnpublish,
  onDraftChange,
  onError,
}: Props) {
  const label = visibilityLabel(raw, report)
  const featuredIds = Array.isArray(raw.featuredMediaIds)
    ? (raw.featuredMediaIds as string[])
    : []

  const severityColor = SEVERITY_COLORS[report.severity] || 'var(--color-text-muted)'
  const typeInitial = (report.type || '?').slice(0, 1).toUpperCase()
  const badgeStyle = STATUS_BADGE_STYLES[label] ?? { color: 'var(--color-text-muted)', bg: 'rgba(255,255,255,0.06)' }

  const severityBorder = report.severity === 'high' ? 'border-t-2' : 'border-t-0'
  const severityBorderColor = report.severity === 'high' ? severityColor : 'transparent'

  return (
    <article
      className={`rounded-xl bg-[var(--color-surface-elevated)] p-5 ${severityBorder}`}
      style={{ borderColor: severityBorderColor }}
    >
      {/* Card Header */}
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: severityColor }}
          aria-hidden="true"
        >
          {typeInitial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {report.municipality || 'Unknown municipality'}
            </p>
            <span className="text-xs text-[var(--color-text-muted)]">
              {report.barangay || 'Unknown barangay'} · {report.type}
            </span>
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{
            color: badgeStyle.color,
            backgroundColor: badgeStyle.bg,
          }}
        >
          {label}
        </span>
      </div>

      {/* Card Body */}
      <div className="mt-3">
        {canPublish ? (
          <div>
            <label
              htmlFor={`scrubbed-${report.id}`}
              className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]"
            >
              Kopyang nilinis
            </label>
            <textarea
              id={`scrubbed-${report.id}`}
              aria-label={`Kopyang nilinis para sa ${report.id}`}
              value={draft}
              onChange={(event) => {
                onDraftChange(event.target.value)
              }}
              placeholder="I-edit ang deskripsyon bago i-publish..."
              className="min-h-[80px] w-full rounded-lg border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-info)] focus:outline-none focus:ring-1 focus:ring-[var(--color-info)]"
            />
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-text-primary)]">
            {report.description.trim() || 'Report details pending'}
          </p>
        )}
      </div>

      {/* Media */}
      <PhotoGallery
        reportId={report.id}
        mediaUrls={mediaUrls}
        initialFeaturedIds={featuredIds}
        onError={onError}
      />

      {/* Action Bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
        {report.status === 'new' && (
          <Tooltip content="Verify this report and send it to the moderation queue for review before publication.">
            <button
              type="button"
              onClick={onVerify}
              disabled={isPending}
              className="rounded-lg bg-[var(--color-info)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Send report ${report.id} to moderation`}
            >
              {isPending ? 'Sending…' : 'Send to moderation'}
            </button>
          </Tooltip>
        )}
        {canPublish && (
          <Tooltip content="Make this report visible to the public as an alert.">
            <button
              type="button"
              onClick={onPublish}
              disabled={isPublishing}
              className="rounded-lg bg-[var(--color-success)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`I-publish ang kopyang nilinis para sa ${report.id}`}
            >
              {isPublishing ? 'Publishing…' : 'I-publish'}
            </button>
          </Tooltip>
        )}
        {canUnpublish && (
          <Tooltip content="Remove this report from public alerts and return it to the moderation queue.">
            <button
              type="button"
              onClick={onUnpublish}
              disabled={isPending}
              className="rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Unpublish report ${report.id}`}
            >
              {isPending ? 'Unpublishing…' : 'Unpublish'}
            </button>
          </Tooltip>
        )}
      </div>
    </article>
  )
}
