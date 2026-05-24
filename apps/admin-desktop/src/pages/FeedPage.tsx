import { useMemo, useState, useEffect, useRef } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
import { CommandHeader } from '../components/CommandHeader'
import { OfflineBanner } from '../components/OfflineBanner'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { callables } from '../services/callables'
import { db } from '../app/firebase'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import type { Report } from '../types'

function visibilityLabel(doc: Record<string, unknown>, report: Report): string {
  if (doc.visibilityClass === 'public_alertable') return 'Published'
  if (report.status === 'awaiting_verify') return 'Pending publication'
  if (report.status === 'verified') return 'Unpublished'
  return 'Intake'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function toMillis(value: unknown): number {
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

function reportMillis(raw: Record<string, unknown>, report: Report): number {
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

export default function FeedPage() {
  const { signOut } = useAuth()
  const { loading, error, reports, alerts } = useFirestoreListeners({ windowType: 'dashboard', db })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
  const [unpublishingIds, setUnpublishingIds] = useState<Set<string>>(new Set())
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingFeaturedIds, setPendingFeaturedIds] = useState<Record<string, string[]>>({})
  const writeQueues = useRef(new Map<string, Promise<void>>())
  const [mediaUrlsByReport, setMediaUrlsByReport] = useState<
    Record<string, { uploadId: string; url: string }[]>
  >({})
  const lastUpdatedAt = useMemo(() => {
    if (reports.length === 0) return 0
    return Math.max(
      ...reports.map((r) => {
        const raw = r as unknown as Record<string, unknown>
        const ts = raw.updatedAt
        return typeof ts === 'number' ? ts : 0
      }),
    )
  }, [reports])

  const feedReports = useMemo(
    () =>
      reports
        .map((doc) => {
          const raw = doc as unknown as Record<string, unknown>
          return { raw, report: mapReportDocToReportLoose(raw) }
        })
        .filter(
          ({ raw, report }) =>
            raw.visibilityClass === 'public_alertable' ||
            report.status === 'awaiting_verify' ||
            report.status === 'new',
        ),
    [reports],
  )

  const publicFeedReports = useMemo(
    () =>
      feedReports
        .filter(({ raw }) => raw.visibilityClass === 'public_alertable')
        .sort((a, b) => reportMillis(b.raw, b.report) - reportMillis(a.raw, a.report)),
    [feedReports],
  )

  const officialAlerts = useMemo(
    () =>
      alerts
        .filter(isRecord)
        .sort(
          (a, b) =>
            toMillis(b.publishedAt ?? b.declaredAt) - toMillis(a.publishedAt ?? a.declaredAt),
        )
        .slice(0, 5),
    [alerts],
  )

  const reportIdsKey = feedReports.map(({ report }) => report.id).join(',')
  useEffect(() => {
    let cancelled = false
    async function fetchMedia() {
      const urls: Record<string, { uploadId: string; url: string }[]> = {}
      for (const { report } of feedReports) {
        try {
          const mediaSnap = await getDocs(collection(db, 'reports', report.id, 'media'))
          const promises = mediaSnap.docs.map(async (d) => {
            const data = d.data()
            if (typeof data.storagePath !== 'string') return null
            try {
              const url = await getDownloadURL(ref(getStorage(), data.storagePath))
              return { uploadId: d.id, url }
            } catch (e) {
              console.error(`Failed to resolve media URL for report ${report.id}, media ${d.id}`, e)
              return null
            }
          })
          const settled = await Promise.allSettled(promises)
          urls[report.id] = settled
            .filter(
              (r): r is PromiseFulfilledResult<{ uploadId: string; url: string } | null> =>
                r.status === 'fulfilled',
            )
            .map((r) => r.value)
            .filter((v): v is { uploadId: string; url: string } => v !== null)
        } catch (e) {
          console.error(`Failed to fetch media for report ${report.id}`, e)
          urls[report.id] = []
        }
      }
      if (!cancelled) setMediaUrlsByReport(urls)
    }
    void fetchMedia()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportIdsKey])

  async function publishScrubbed(report: Report) {
    const scrubbedDescription = (drafts[report.id] ?? report.description).trim()
    if (!scrubbedDescription) {
      setActionError('Scrubbed copy cannot be empty.')
      return
    }
    setPublishingIds((prev) => new Set(prev).add(report.id))
    try {
      await callables.verifyReport({
        reportId: report.id,
        scrubbedDescription,
        idempotencyKey: generateIdempotencyKey(),
      })
      setActionError(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishingIds((prev) => {
        const next = new Set(prev)
        next.delete(report.id)
        return next
      })
    }
  }

  async function sendToModeration(report: Report) {
    setVerifyingIds((prev) => new Set(prev).add(report.id))
    try {
      await callables.verifyReport({
        reportId: report.id,
        idempotencyKey: generateIdempotencyKey(),
      })
      setActionError(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Send to moderation failed')
    } finally {
      setVerifyingIds((prev) => {
        const next = new Set(prev)
        next.delete(report.id)
        return next
      })
    }
  }

  async function unpublish(report: Report) {
    setUnpublishingIds((prev) => new Set(prev).add(report.id))
    try {
      await callables.unpublishReport({
        reportId: report.id,
        reason: 'sensitive_content',
        idempotencyKey: generateIdempotencyKey(),
      })
      setActionError(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unpublish failed')
    } finally {
      setUnpublishingIds((prev) => {
        const next = new Set(prev)
        next.delete(report.id)
        return next
      })
    }
  }

  async function saveFeaturedMedia(reportId: string, selectedIds: string[]) {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        featuredMediaIds: selectedIds,
      })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save featured media')
      setPendingFeaturedIds((prev) => {
        const { [reportId]: _removed, ...rest } = prev
        void _removed
        return rest
      })
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col bg-[var(--color-surface)]">
        <OfflineBanner error={error} />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-surface)]">
      <OfflineBanner error={error} />
      <CommandHeader
        title="Feed moderation"
        windowRole="feed"
        lastUpdatedAt={lastUpdatedAt}
        onSignOut={() => {
          signOut()
            .then(() => {
              setActionError(null)
            })
            .catch((err: unknown) => {
              setActionError(err instanceof Error ? err.message : 'Sign out failed')
            })
        }}
      />
      <main className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Feed moderation
          </h1>
          <span className="text-xs text-[var(--color-text-muted)]">
            {feedReports.length} report{feedReports.length === 1 ? '' : 's'}
          </span>
        </div>
        {actionError && (
          <div
            className="mb-4 border border-[var(--color-danger)] bg-[var(--color-danger)]/20 px-4 py-2 text-sm text-[var(--color-danger)]"
            role="alert"
          >
            {actionError}
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <section
            aria-label="Feed moderation queue"
            className="overflow-hidden rounded-lg border border-white/10 bg-[var(--color-surface-elevated)]"
          >
            {feedReports.length === 0 ? (
              <p className="p-4 text-sm text-[var(--color-text-secondary)]">
                No report feed items need moderation.
              </p>
            ) : (
              <div className="divide-y divide-white/10">
                {feedReports.map(({ raw, report }) => {
                  const label = visibilityLabel(raw, report)
                  const draft = drafts[report.id] ?? report.description
                  const canPublish = report.status === 'awaiting_verify'
                  const canUnpublish = raw.visibilityClass === 'public_alertable'
                  return (
                    <article
                      key={report.id}
                      className="grid gap-3 p-4 lg:grid-cols-[220px_1fr_220px]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {report.municipality || 'Unknown municipality'}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {report.barangay || 'Unknown barangay'} / {report.type}
                        </p>
                      </div>
                      <label className="block text-sm text-[var(--color-text-secondary)]">
                        <span className="sr-only">Scrubbed copy for {report.id}</span>
                        <textarea
                          aria-label={`Scrubbed copy for ${report.id}`}
                          value={draft}
                          readOnly={!canPublish}
                          onChange={(event) => {
                            setDrafts((prev) => ({ ...prev, [report.id]: event.target.value }))
                          }}
                          className="min-h-20 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                        />
                      </label>
                      <div className="flex flex-col items-start gap-2 lg:items-end">
                        <span className="rounded-sm border border-white/10 px-2 py-1 text-xs uppercase text-[var(--color-text-secondary)]">
                          {label}
                        </span>
                        {report.status === 'new' && (
                          <button
                            type="button"
                            onClick={() => {
                              void sendToModeration(report)
                            }}
                            disabled={verifyingIds.has(report.id)}
                            className="rounded bg-[var(--color-info)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Send report ${report.id} to moderation`}
                          >
                            {verifyingIds.has(report.id) ? 'Sending…' : 'Send to moderation'}
                          </button>
                        )}
                        {canPublish && (
                          <button
                            type="button"
                            onClick={() => {
                              void publishScrubbed(report)
                            }}
                            disabled={publishingIds.has(report.id)}
                            className="rounded bg-[var(--color-success)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Publish scrubbed copy for ${report.id}`}
                          >
                            {publishingIds.has(report.id) ? 'Publishing' : 'Publish scrubbed copy'}
                          </button>
                        )}
                        {canUnpublish && (
                          <button
                            type="button"
                            onClick={() => {
                              void unpublish(report)
                            }}
                            disabled={unpublishingIds.has(report.id)}
                            className="rounded border border-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Unpublish report ${report.id}`}
                          >
                            {unpublishingIds.has(report.id) ? 'Unpublishing' : 'Unpublish'}
                          </button>
                        )}
                      </div>
                      {/* Photo gallery */}
                      {(() => {
                        const reportMedia = mediaUrlsByReport[report.id]
                        if (!reportMedia || reportMedia.length === 0) return null
                        return (
                          <div className="col-span-full">
                            <p className="mb-1 text-xs text-[var(--color-text-muted)]">Photos:</p>
                            <div className="flex flex-wrap gap-2">
                              {reportMedia.map(({ uploadId, url }, idx) => {
                                const firestoreIds = Array.isArray(raw.featuredMediaIds)
                                  ? (raw.featuredMediaIds as string[])
                                  : []
                                const pending = pendingFeaturedIds[report.id]
                                const currentIds = pending ?? firestoreIds
                                const isSelected = currentIds.includes(uploadId)
                                return (
                                  <label
                                    key={uploadId}
                                    className={`relative cursor-pointer overflow-hidden rounded border-2 ${
                                      isSelected
                                        ? 'border-[var(--color-success)]'
                                        : 'border-white/10'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const checked = e.target.checked
                                        const base = pendingFeaturedIds[report.id] ?? firestoreIds
                                        const next = checked
                                          ? [...base, uploadId]
                                          : base.filter((id) => id !== uploadId)
                                        setPendingFeaturedIds((prev) => ({
                                          ...prev,
                                          [report.id]: next,
                                        }))
                                        const prevWrite =
                                          writeQueues.current.get(report.id) ?? Promise.resolve()
                                        const chained = prevWrite.then(() =>
                                          saveFeaturedMedia(report.id, next),
                                        )
                                        writeQueues.current.set(report.id, chained)
                                      }}
                                      className="absolute left-1 top-1 z-10"
                                      aria-label={`Select photo ${String(idx + 1)}`}
                                    />
                                    <span className="sr-only">
                                      Photo {String(idx + 1)}{' '}
                                      {isSelected ? '(selected)' : '(unselected)'}
                                    </span>
                                    <img
                                      src={url}
                                      alt=""
                                      className="h-[60px] w-[80px] object-cover"
                                    />
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <div className="space-y-4">
            <section
              aria-label="Recent official alerts"
              className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Recent official alerts
                </h2>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {officialAlerts.length} active
                </span>
              </div>
              {officialAlerts.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No recent official alerts.
                </p>
              ) : (
                <div className="space-y-3">
                  {officialAlerts.map((alert, index) => {
                    const hazardType = readString(alert, 'hazardType') || 'official alert'
                    const message = readString(alert, 'message') || 'Alert details pending'
                    const municipalities = readStringList(alert, 'affectedMunicipalityIds')
                    const alertTime = formatFeedTime(
                      toMillis(alert.publishedAt ?? alert.declaredAt),
                    )
                    return (
                      <article
                        key={readString(alert, 'id') || `alert-${String(index)}`}
                        className="rounded border border-white/10 bg-[var(--color-surface)] p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase text-[var(--color-danger)]">
                            {hazardType}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">{alertTime}</p>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)]">{message}</p>
                        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                          {municipalities.length > 0 ? municipalities.join(', ') : 'Province-wide'}
                        </p>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section
              aria-label="Citizen-visible public feed"
              className="rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Public feed preview
                </h2>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {publicFeedReports.length} visible
                </span>
              </div>
              {publicFeedReports.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No reports are visible to citizens yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {publicFeedReports.map(({ raw, report }) => {
                    const submittedAt = reportMillis(raw, report)
                    const reportMedia = mediaUrlsByReport[report.id] ?? []
                    const featuredIds = report.featuredMediaIds ?? []
                    const visibleMedia =
                      featuredIds.length > 0
                        ? reportMedia.filter((media) => featuredIds.includes(media.uploadId))
                        : []
                    const location =
                      report.municipality || report.barangay
                        ? `${report.municipality || 'Unknown municipality'} / ${
                            report.barangay || 'Unknown barangay'
                          }`
                        : 'Location pending'
                    return (
                      <article
                        key={`public-${report.id}`}
                        className="rounded border border-white/10 bg-[var(--color-surface)] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-info)]/20 text-xs font-semibold uppercase text-[var(--color-info)]">
                            {report.severity.slice(0, 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                Verified public report
                              </p>
                              <span className="text-xs text-[var(--color-text-muted)]">
                                {report.type}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                              {formatFeedTime(submittedAt)} / {location}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-primary)]">
                          {report.description.trim() || 'Report details pending'}
                        </p>
                        {visibleMedia.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {visibleMedia.slice(0, 4).map((media, index) => (
                              <img
                                key={media.uploadId}
                                src={media.url}
                                alt={`Public report media ${String(index + 1)}`}
                                className="aspect-video w-full rounded object-cover"
                              />
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs text-[var(--color-text-muted)]">
                          <span>Published to public feed</span>
                          <span aria-hidden="true">/</span>
                          <span>{report.status.replaceAll('_', ' ')}</span>
                          <span aria-hidden="true">/</span>
                          <span>{report.severity}</span>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
