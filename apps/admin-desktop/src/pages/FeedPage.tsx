import { useMemo, useState, useEffect } from 'react'
import { FeedCard } from '../components/FeedCard'
import { OfflineBanner } from '../components/OfflineBanner'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { SuccessBanner } from '../components/SuccessBanner'
import { ActionErrorBanner } from '../components/ActionErrorBanner'
import { useFirestoreListeners, type SituationUpdateDoc } from '../hooks/useFirestoreListeners'
import { callables } from '../services/callables'
import { db } from '../app/firebase'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { withRetry } from '../utils/withRetry'
import { useOptimisticFeedActions } from '../hooks/useOptimisticFeedActions'
import { resolveReportMedia, type MediaItem } from '../utils/media-fetch'
import type { Report } from '../types'

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

const SEVERITY_COLORS: Record<string, string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-info)',
}

function isPublicVisibility(value: unknown): boolean {
  return value === 'public'
}

// Flagged-first so citizen-reported posts surface even under flood volume;
// no cap — the admin moderation window must cover everything citizens can see.
function sortFlaggedFirst(updates: SituationUpdateDoc[]): SituationUpdateDoc[] {
  return [...updates].sort(
    (a, b) =>
      (b.reportedCount ?? 0) - (a.reportedCount ?? 0) ||
      toMillis(b.createdAt) - toMillis(a.createdAt),
  )
}

function visiblePublicPostsByAuthor(
  updates: SituationUpdateDoc[],
  authorUid: string | null,
): SituationUpdateDoc[] {
  if (authorUid === null) return []
  return updates.filter(
    (update) => update.authorUid === authorUid && isPublicVisibility(update.visibility),
  )
}

function hideAuthorMessage(count: number, authorUid: string | null): string {
  const plural = count === 1 ? '' : 's'
  return `This will hide ${String(count)} public post${plural} by ${authorUid ?? ''} from the Citizen PWA.`
}

export default function FeedPage() {
  const { loading, error, reports, alerts, situationUpdates } = useFirestoreListeners({
    windowType: 'dashboard',
    db,
  })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
  const [moderatingContentIds, setModeratingContentIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [mediaUrlsByReport, setMediaUrlsByReport] = useState<Record<string, MediaItem[]>>({})
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [confirmUnpublishReport, setConfirmUnpublishReport] = useState<Report | null>(null)
  const [confirmHideAuthor, setConfirmHideAuthor] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'new' | 'pending' | 'live'>('new')

  const { optimisticReports, optimisticVerify, optimisticUnpublish, pendingIds } =
    useOptimisticFeedActions({
      reports,
      verifyReport: async (reportId) => {
        // Keys generated before withRetry so every attempt replays the same key.
        const idempotencyKey = generateIdempotencyKey()
        await withRetry(() => callables.verifyReport({ reportId, idempotencyKey }))
      },
      unpublishReport: async (reportId) => {
        const idempotencyKey = generateIdempotencyKey()
        await withRetry(() =>
          callables.unpublishReport({
            reportId,
            reason: 'sensitive_content',
            idempotencyKey,
          }),
        )
      },
      onError: (_reportId, err) => {
        setActionError(err instanceof Error ? err.message : 'Action failed')
      },
    })

  const feedReports = useMemo(
    () =>
      optimisticReports
        .map((doc) => {
          const raw = doc as unknown as Record<string, unknown>
          return { raw, report: mapReportDocToReportLoose(raw) }
        })
        .filter(
          ({ raw, report }) =>
            raw.visibilityClass === 'public_alertable' ||
            report.status === 'awaiting_verify' ||
            report.status === 'new',
        )
        .sort((a, b) => reportMillis(b.raw, b.report) - reportMillis(a.raw, a.report)),
    [optimisticReports],
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

  const citizenSituationUpdates = useMemo(
    () => sortFlaggedFirst(situationUpdates),
    [situationUpdates],
  )

  const handleVerify = async (reportId: string) => {
    try {
      await optimisticVerify(reportId)
      setSuccessMessage('Naipadala sa pagmamoderate.')
    } catch {
      // error already handled by onError callback
    }
  }

  const handleUnpublish = async (reportId: string) => {
    try {
      await optimisticUnpublish(reportId)
      setSuccessMessage('Naalis sa pampublikong feed.')
    } catch {
      // error already handled by onError callback
    }
  }

  const handleCitizenContentVisibility = async (
    surface: 'feed' | 'alerts',
    contentId: string,
    currentVisibility: unknown,
  ) => {
    const visibility = isPublicVisibility(currentVisibility) ? 'internal' : 'public'
    const pendingKey = `${surface}:${contentId}`
    setModeratingContentIds((prev) => new Set(prev).add(pendingKey))
    try {
      const idempotencyKey = generateIdempotencyKey()
      await withRetry(() =>
        callables.setCitizenContentVisibility({
          surface,
          contentId,
          visibility,
          reason: surface === 'alerts' ? 'other' : 'sensitive_content',
          idempotencyKey,
        }),
      )
      setActionError(null)
      setSuccessMessage(
        surface === 'alerts'
          ? visibility === 'public'
            ? 'Alert restored to Citizen PWA.'
            : 'Alert retired from Citizen PWA.'
          : visibility === 'public'
            ? 'Naibalik sa Citizen PWA.'
            : 'Naitago sa Citizen PWA.',
      )
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Visibility update failed')
    } finally {
      setModeratingContentIds((prev) => {
        const next = new Set(prev)
        next.delete(pendingKey)
        return next
      })
    }
  }

  const hideAuthorTargets = useMemo(
    () => visiblePublicPostsByAuthor(citizenSituationUpdates, confirmHideAuthor),
    [citizenSituationUpdates, confirmHideAuthor],
  )

  const handleHideAllByAuthor = async (targets: typeof citizenSituationUpdates) => {
    // ponytail: sequential fan-out of the per-post callable; a bulk endpoint
    // only matters past the 60/min moderation rate limit (>60 posts/author).
    for (const post of targets) {
      await handleCitizenContentVisibility('feed', post.id, post.visibility)
    }
  }

  // SuccessBanner now owns its own auto-dismiss (4s). FeedPage must NOT
  // duplicate the timer, otherwise both race to clear successMessage and the
  // banner may flicker or disappear early.
  // useEffect(() => {
  //   if (!successMessage) return
  //   const timer = setTimeout(() => {
  //     setSuccessMessage(null)
  //   }, 4000)
  //   return () => {
  //     clearTimeout(timer)
  //   }
  // }, [successMessage])

  const newReports = useMemo(
    () => feedReports.filter(({ report }) => report.status === 'new'),
    [feedReports],
  )

  const pendingReports = useMemo(
    () => feedReports.filter(({ report }) => report.status === 'awaiting_verify'),
    [feedReports],
  )

  const tabReports = useMemo(() => {
    switch (activeTab) {
      case 'new':
        return newReports
      case 'pending':
        return pendingReports
      case 'live':
        return publicFeedReports
      default:
        return newReports
    }
  }, [activeTab, newReports, pendingReports, publicFeedReports])

  const reportIdsKey = feedReports.map(({ report }) => report.id).join(',')
  useEffect(() => {
    let cancelled = false
    async function fetchMedia() {
      const reportIds = feedReports.map(({ report }) => report.id)
      // Bounded concurrency: at most 6 reports' media resolve in parallel.
      // Without this, a live feed re-key fires N+M reads all at once and stalls
      // the UI. resolveReportMedia swallows per-report failures and returns an
      // empty array for them, so a single bad report doesn't abort the batch.
      const { byReport, failedCount } = await resolveReportMedia(db, reportIds)
      if (cancelled) return
      setMediaUrlsByReport(byReport)
      if (failedCount > 0) {
        setMediaError(
          `${String(failedCount)} report${failedCount === 1 ? '' : 's'} had photos that failed to load. Reload the page to retry.`,
        )
      }
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
      setActionError('Kopyang nilinis ay hindi maaaring walang laman.')
      return
    }
    setPublishingIds((prev) => new Set(prev).add(report.id))
    try {
      const idempotencyKey = generateIdempotencyKey()
      await withRetry(() =>
        callables.verifyReport({
          reportId: report.id,
          scrubbedDescription,
          idempotencyKey,
        }),
      )
      setActionError(null)
      setSuccessMessage('Na-publish sa pampublikong feed.')
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

  if (loading) {
    return (
      <>
        {error && <OfflineBanner error={error} />}
        <PageSkeleton variant="feed" />
      </>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-surface)]">
      <OfflineBanner error={error} />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto grid max-w-[1200px] gap-6 p-6 lg:grid-cols-[1fr_360px]">
          {/* Left: Feed Stream */}
          <section aria-label="Feed moderation queue" className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
                Feed moderation
              </h1>
              <span className="text-xs text-[var(--color-text-muted)]">
                {newReports.length} new · {pendingReports.length} pending ·{' '}
                {publicFeedReports.length} map/feed live · {officialAlerts.length} alert
                {officialAlerts.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Tabs */}
            <nav aria-label="Moderation queue tabs" className="flex border-b border-white/10">
              {[
                { key: 'new' as const, label: `New (${String(newReports.length)})` },
                { key: 'pending' as const, label: `Pending (${String(pendingReports.length)})` },
                { key: 'live' as const, label: `Live (${String(publicFeedReports.length)})` },
              ].map((tab) => {
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key)
                    }}
                    className="px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    style={{
                      color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      borderBottom: active
                        ? '2px solid var(--color-success)'
                        : '2px solid transparent',
                    }}
                    aria-current={active ? 'page' : undefined}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>

            {successMessage && (
              <SuccessBanner
                message={successMessage}
                onDismiss={() => {
                  setSuccessMessage(null)
                }}
              />
            )}

            {actionError && (
              <ActionErrorBanner
                message={actionError}
                onDismiss={() => {
                  setActionError(null)
                }}
              />
            )}
            {mediaError && (
              <div
                className="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]"
                role="alert"
              >
                {mediaError}
                <button
                  onClick={() => {
                    setMediaError(null)
                  }}
                  className="ml-3 underline"
                  aria-label="Dismiss media error"
                >
                  Dismiss
                </button>
              </div>
            )}

            {tabReports.length === 0 ? (
              <div className="rounded-xl bg-[var(--color-surface-elevated)] p-8 text-center">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {activeTab === 'new'
                    ? 'Walang bagong ulat na nangangailangan ng pagmamoderate.'
                    : activeTab === 'pending'
                      ? 'Walang nakaantabay na ulat na nangangailangan ng paglilinis.'
                      : 'Walang live na ulat sa pampublikong feed.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tabReports.map(({ raw, report }) => (
                  <FeedCard
                    key={report.id}
                    raw={raw}
                    report={report}
                    draft={drafts[report.id] ?? report.description}
                    canPublish={report.status === 'awaiting_verify'}
                    canUnpublish={raw.visibilityClass === 'public_alertable'}
                    isPending={pendingIds.has(report.id)}
                    isPublishing={publishingIds.has(report.id)}
                    mediaUrls={mediaUrlsByReport[report.id] ?? []}
                    onVerify={() => void handleVerify(report.id)}
                    onPublish={() => void publishScrubbed(report)}
                    onUnpublish={() => {
                      setConfirmUnpublishReport(report)
                    }}
                    onDraftChange={(value) => {
                      setDrafts((prev) => ({ ...prev, [report.id]: value }))
                    }}
                    onError={(msg) => {
                      setActionError(msg)
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Right: Widgets Sidebar */}
          <aside className="space-y-5">
            {/* Official Alerts Widget */}
            <section
              aria-label="Recent official alerts"
              className="rounded-xl bg-[var(--color-surface-elevated)] p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Official alerts
                </h2>
                <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
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
                    const alertId = readString(alert, 'id') || readString(alert, 'alertId')
                    const isPublic = isPublicVisibility(alert.visibility)
                    const pending = moderatingContentIds.has(`alerts:${alertId}`)
                    return (
                      <article
                        key={alertId || `alert-${String(index)}`}
                        className="rounded-lg bg-[var(--color-surface)] p-3"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-danger)]">
                            {readString(alert, 'hazardType') || 'official alert'}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {formatFeedTime(toMillis(alert.publishedAt ?? alert.declaredAt))}
                          </p>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)]">
                          {readString(alert, 'message') || 'Alert details pending'}
                        </p>
                        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                          {readStringList(alert, 'affectedMunicipalityIds').length > 0
                            ? readStringList(alert, 'affectedMunicipalityIds').join(', ')
                            : 'Province-wide'}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              isPublic
                                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                                : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                            }`}
                          >
                            {isPublic ? 'Visible to citizens' : 'Hidden from citizens'}
                          </span>
                          <button
                            type="button"
                            disabled={!alertId || pending}
                            onClick={() => {
                              if (alertId) {
                                void handleCitizenContentVisibility(
                                  'alerts',
                                  alertId,
                                  alert.visibility,
                                )
                              }
                            }}
                            className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`${isPublic ? 'Retire' : 'Restore retired'} alert ${alertId}`}
                          >
                            {pending ? 'Updating...' : isPublic ? 'Retire' : 'Restore'}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section
              aria-label="Citizen feed moderation"
              className="rounded-xl bg-[var(--color-surface-elevated)] p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Citizen feed posts
                </h2>
                <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
                  {citizenSituationUpdates.length} recent
                </span>
              </div>
              {citizenSituationUpdates.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No citizen situation posts in scope.
                </p>
              ) : (
                <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                  {citizenSituationUpdates.map((update) => {
                    const isPublic = isPublicVisibility(update.visibility)
                    const pending = moderatingContentIds.has(`feed:${update.id}`)
                    return (
                      <article key={update.id} className="rounded-lg bg-[var(--color-surface)] p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-info)]">
                            {update.hazardType ?? 'situation'}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {formatFeedTime(toMillis(update.createdAt))}
                          </p>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)]">
                          {update.body ?? 'Situation details pending'}
                        </p>
                        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                          {update.barangayLabel ? `${update.barangayLabel}, ` : ''}
                          {update.municipalityLabel ?? update.municipalityId ?? 'Location pending'}
                          {typeof update.reportedCount === 'number'
                            ? ` · ${String(update.reportedCount)} report${
                                update.reportedCount === 1 ? '' : 's'
                              }`
                            : ''}
                          {update.authorUid ? ` · by ${update.authorUid}` : ''}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              isPublic
                                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                                : 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                            }`}
                          >
                            {isPublic ? 'Visible to citizens' : 'Hidden from citizens'}
                          </span>
                          <div className="flex items-center gap-2">
                            {update.authorUid && (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => {
                                  setConfirmHideAuthor(update.authorUid ?? null)
                                }}
                                className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Hide all posts by ${update.authorUid}`}
                              >
                                Hide all by author
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => {
                                void handleCitizenContentVisibility(
                                  'feed',
                                  update.id,
                                  update.visibility,
                                )
                              }}
                              className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label={`${isPublic ? 'Hide' : 'Restore'} situation update ${
                                update.id
                              }`}
                            >
                              {pending ? 'Updating...' : isPublic ? 'Hide' : 'Restore'}
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Public Feed Preview Widget */}
            <section
              aria-label="Citizen-visible public feed"
              className="rounded-xl bg-[var(--color-surface-elevated)] p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Public feed preview
                </h2>
                <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
                  {publicFeedReports.length} visible
                </span>
              </div>
              {publicFeedReports.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No reports are visible to citizens yet.
                </p>
              ) : (
                <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
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
                              backgroundColor:
                                SEVERITY_COLORS[report.severity] ?? 'var(--color-text-muted)',
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
                              {formatFeedTime(submittedAt)} · {location}
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
              )}
            </section>
          </aside>
        </div>
      </main>
      <ConfirmationModal
        open={confirmHideAuthor !== null}
        title="Hide all posts by author"
        message={hideAuthorMessage(hideAuthorTargets.length, confirmHideAuthor)}
        confirmLabel="Hide all"
        confirmVariant="danger"
        onConfirm={() => {
          void handleHideAllByAuthor(hideAuthorTargets)
          setConfirmHideAuthor(null)
        }}
        onCancel={() => {
          setConfirmHideAuthor(null)
        }}
      />
      <ConfirmationModal
        open={confirmUnpublishReport !== null}
        title="Unpublish Report"
        message="This will hide the report from the public feed. Citizens will no longer see it."
        confirmLabel="Unpublish"
        confirmVariant="danger"
        onConfirm={() => {
          if (confirmUnpublishReport) {
            void handleUnpublish(confirmUnpublishReport.id)
          }
          setConfirmUnpublishReport(null)
        }}
        onCancel={() => {
          setConfirmUnpublishReport(null)
        }}
      />
    </div>
  )
}
