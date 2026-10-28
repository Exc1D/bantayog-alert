import type { ReactNode } from 'react'
import type { SituationUpdateDoc } from '../hooks/useFirestoreListeners'
import type { MediaItem } from '../utils/media-fetch'
import type { Report } from '../types'

export interface FeedReport {
  raw: Record<string, unknown>
  report: Report
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function isPublicVisibility(value: unknown): boolean {
  return value === 'public'
}

export function toMillis(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (isRecord(value) && typeof value.toDate === 'function') {
    const date = (value.toDate as () => Date)()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0
  }
  return 0
}

export function reportMillis({ raw, report }: FeedReport): number {
  return toMillis(raw.submittedAt ?? raw.createdAt) || toMillis(report.createdAt)
}

function formatFeedTime(millis: number): string {
  if (millis <= 0) return 'Time pending'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(millis))
}

function readString(doc: Record<string, unknown>, field: string): string {
  const value = doc[field]
  return typeof value === 'string' ? value : ''
}

function readStringList(doc: Record<string, unknown>, field: string): string[] {
  const value = doc[field]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

const SEVERITY_COLORS: Record<string, string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-info)',
}

const SMALL_BUTTON_CLASS =
  'rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50'

function SidebarWidget({
  label,
  title,
  badge,
  emptyText,
  children,
}: {
  label: string
  title: string
  badge: string
  emptyText?: string
  children: ReactNode
}) {
  return (
    <section aria-label={label} className="rounded-xl bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
        <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
          {badge}
        </span>
      </div>
      {emptyText ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{emptyText}</p>
      ) : (
        children
      )}
    </section>
  )
}

function VisibilityPill({ isPublic }: { isPublic: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] ${
        isPublic
          ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
          : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
      }`}
    >
      {isPublic ? 'Visible to citizens' : 'Hidden from citizens'}
    </span>
  )
}

function ItemHeader({ kind, kindClass, time }: { kind: string; kindClass: string; time: number }) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${kindClass}`}>{kind}</p>
      <p className="text-[11px] text-[var(--color-text-muted)]">{formatFeedTime(time)}</p>
    </div>
  )
}

export function OfficialAlertsWidget({
  alerts,
  moderatingIds,
  onToggleVisibility,
}: {
  alerts: readonly Record<string, unknown>[]
  moderatingIds: ReadonlySet<string>
  onToggleVisibility: (alertId: string, currentVisibility: unknown) => void
}) {
  return (
    <SidebarWidget
      label="Recent official alerts"
      title="Official alerts"
      badge={`${String(alerts.length)} active`}
      {...(alerts.length === 0 ? { emptyText: 'No recent official alerts.' } : {})}
    >
      <div className="space-y-3">
        {alerts.map((alert, index) => {
          const alertId = readString(alert, 'id') || readString(alert, 'alertId')
          const isPublic = isPublicVisibility(alert.visibility)
          const pending = moderatingIds.has(`alerts:${alertId}`)
          const municipalities = readStringList(alert, 'affectedMunicipalityIds')
          return (
            <article
              key={alertId || `alert-${String(index)}`}
              className="rounded-lg bg-[var(--color-surface)] p-3"
            >
              <ItemHeader
                kind={readString(alert, 'hazardType') || 'official alert'}
                kindClass="text-[var(--color-danger)]"
                time={toMillis(alert.publishedAt ?? alert.declaredAt)}
              />
              <p className="text-sm text-[var(--color-text-primary)]">
                {readString(alert, 'message') || 'Alert details pending'}
              </p>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                {municipalities.length > 0 ? municipalities.join(', ') : 'Province-wide'}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <VisibilityPill isPublic={isPublic} />
                <button
                  type="button"
                  disabled={!alertId || pending}
                  onClick={() => {
                    if (alertId) onToggleVisibility(alertId, alert.visibility)
                  }}
                  className={SMALL_BUTTON_CLASS}
                  aria-label={`${isPublic ? 'Retire' : 'Restore retired'} alert ${alertId}`}
                >
                  {pending ? 'Updating...' : isPublic ? 'Retire' : 'Restore'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </SidebarWidget>
  )
}

export function CitizenPostsWidget({
  updates,
  moderatingIds,
  onToggleVisibility,
  onHideAuthor,
}: {
  updates: readonly SituationUpdateDoc[]
  moderatingIds: ReadonlySet<string>
  onToggleVisibility: (updateId: string, currentVisibility: unknown) => void
  onHideAuthor: (authorUid: string) => void
}) {
  return (
    <SidebarWidget
      label="Citizen feed moderation"
      title="Citizen feed posts"
      badge={`${String(updates.length)} recent`}
      {...(updates.length === 0 ? { emptyText: 'No citizen situation posts in scope.' } : {})}
    >
      <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
        {updates.map((update) => {
          const isPublic = isPublicVisibility(update.visibility)
          const pending = moderatingIds.has(`feed:${update.id}`)
          const { authorUid, reportedCount } = update
          return (
            <article key={update.id} className="rounded-lg bg-[var(--color-surface)] p-3">
              <ItemHeader
                kind={update.hazardType ?? 'situation'}
                kindClass="text-[var(--color-info)]"
                time={toMillis(update.createdAt)}
              />
              <p className="text-sm text-[var(--color-text-primary)]">
                {update.body ?? 'Situation details pending'}
              </p>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                {update.barangayLabel ? `${update.barangayLabel}, ` : ''}
                {update.municipalityLabel ?? update.municipalityId ?? 'Location pending'}
                {typeof reportedCount === 'number'
                  ? ` · ${String(reportedCount)} report${reportedCount === 1 ? '' : 's'}`
                  : ''}
                {authorUid ? ` · by ${authorUid}` : ''}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <VisibilityPill isPublic={isPublic} />
                <div className="flex items-center gap-2">
                  {authorUid && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        onHideAuthor(authorUid)
                      }}
                      className={SMALL_BUTTON_CLASS}
                      aria-label={`Hide all posts by ${authorUid}`}
                    >
                      Hide all by author
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      onToggleVisibility(update.id, update.visibility)
                    }}
                    className={SMALL_BUTTON_CLASS}
                    aria-label={`${isPublic ? 'Hide' : 'Restore'} situation update ${update.id}`}
                  >
                    {pending ? 'Updating...' : isPublic ? 'Hide' : 'Restore'}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </SidebarWidget>
  )
}

export function PublicFeedPreview({
  reports,
  mediaUrlsByReport,
}: {
  reports: readonly FeedReport[]
  mediaUrlsByReport: Record<string, MediaItem[]>
}) {
  return (
    <SidebarWidget
      label="Citizen-visible public feed"
      title="Public feed preview"
      badge={`${String(reports.length)} visible`}
      {...(reports.length === 0 ? { emptyText: 'No reports are visible to citizens yet.' } : {})}
    >
      <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
        {reports.map((item) => {
          const { report } = item
          const reportMedia = mediaUrlsByReport[report.id] ?? []
          const featuredIds = report.featuredMediaIds ?? []
          // Only admin-featured photos are shown to citizens.
          const visibleMedia = reportMedia.filter((media) => featuredIds.includes(media.uploadId))
          const location =
            report.municipality || report.barangay
              ? `${report.municipality || 'Unknown municipality'} · ${
                  report.barangay || 'Unknown barangay'
                }`
              : 'Location pending'
          return (
            <article
              key={`public-${report.id}`}
              className="rounded-lg bg-[var(--color-surface)] p-3"
            >
              <div className="flex items-start gap-2">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{
                    backgroundColor: SEVERITY_COLORS[report.severity] ?? 'var(--color-text-muted)',
                  }}
                  aria-hidden="true"
                >
                  {report.type.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {report.municipality || 'Unknown municipality'}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {formatFeedTime(reportMillis(item))} · {location}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-primary)]">
                {report.description.trim() || 'Report details pending'}
              </p>
              {visibleMedia.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {visibleMedia.slice(0, 4).map((media, index) => (
                    <img
                      key={media.uploadId}
                      src={media.url}
                      alt={`Public report media ${String(index + 1)}`}
                      className="aspect-video w-full rounded-md object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
                <span className="rounded-full bg-[var(--color-surface-elevated)] px-2 py-0.5 text-[var(--color-success)]">
                  Published
                </span>
                <span>{report.type}</span>
                <span>{report.severity}</span>
              </div>
            </article>
          )
        })}
      </div>
    </SidebarWidget>
  )
}
