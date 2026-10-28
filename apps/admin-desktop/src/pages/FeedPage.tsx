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
import { withRetry } from '../utils/withRetry'
import { useOptimisticFeedActions } from '../hooks/useOptimisticFeedActions'
import { usePendingIds } from '../hooks/usePendingIds'
import { resolveReportMedia, type MediaItem } from '../utils/media-fetch'
import type { Report } from '../types'
import {
  CitizenPostsWidget,
  OfficialAlertsWidget,
  PublicFeedPreview,
  isPublicVisibility,
  isRecord,
  reportMillis,
  toMillis,
} from '../components/FeedSidebar'

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
  const [publishingIds, whilePublishing] = usePendingIds()
  const [moderatingContentIds, whileModerating] = usePendingIds()
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [mediaUrlsByReport, setMediaUrlsByReport] = useState<Record<string, MediaItem[]>>({})
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [confirmUnpublishReport, setConfirmUnpublishReport] = useState<Report | null>(null)
  const [confirmHideAuthor, setConfirmHideAuthor] = useState<string | null>(null)
  const [hidingAuthorBusy, setHidingAuthorBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<'new' | 'pending' | 'live'>('new')

  const { optimisticReports, optimisticVerify, optimisticUnpublish, pendingIds } =
    useOptimisticFeedActions({
      reports,
      verifyReport: async (reportId) => {
        // Keys generated before withRetry so every attempt replays the same key.
        const idempotencyKey = crypto.randomUUID()
        await withRetry(() => callables.verifyReport({ reportId, idempotencyKey }))
      },
      unpublishReport: async (reportId) => {
        const idempotencyKey = crypto.randomUUID()
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
        .sort((a, b) => reportMillis(b) - reportMillis(a)),
    [optimisticReports],
  )

  const publicFeedReports = useMemo(
    () =>
      feedReports
        .filter(({ raw }) => raw.visibilityClass === 'public_alertable')
        .sort((a, b) => reportMillis(b) - reportMillis(a)),
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
  ): Promise<boolean> => {
    const visibility = isPublicVisibility(currentVisibility) ? 'internal' : 'public'
    const pendingKey = `${surface}:${contentId}`
    try {
      const idempotencyKey = crypto.randomUUID()
      await whileModerating(pendingKey, () =>
        withRetry(() =>
          callables.setCitizenContentVisibility({
            surface,
            contentId,
            visibility,
            reason: surface === 'alerts' ? 'other' : 'sensitive_content',
            idempotencyKey,
          }),
        ),
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
      return true
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Visibility update failed')
      return false
    }
  }

  const hideAuthorTargets = useMemo(
    () => visiblePublicPostsByAuthor(citizenSituationUpdates, confirmHideAuthor),
    [citizenSituationUpdates, confirmHideAuthor],
  )

  const handleHideAllByAuthor = async (targets: typeof citizenSituationUpdates) => {
    // ponytail: sequential fan-out of the per-post callable; a bulk endpoint
    // only matters past the 60/min moderation rate limit (>60 posts/author).
    setHidingAuthorBusy(true)
    let failureCount = 0
    try {
      for (const post of targets) {
        const succeeded = await handleCitizenContentVisibility('feed', post.id, post.visibility)
        if (!succeeded) failureCount += 1
      }
    } finally {
      setHidingAuthorBusy(false)
    }
    setConfirmHideAuthor(null)
    if (failureCount > 0) {
      setSuccessMessage(null)
      setActionError(
        `Hid ${String(targets.length - failureCount)} of ${String(targets.length)} posts; ${String(failureCount)} failed.`,
      )
    } else {
      setActionError(null)
      setSuccessMessage(`Hid ${String(targets.length)} post${targets.length === 1 ? '' : 's'}.`)
    }
  }

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
    try {
      const idempotencyKey = crypto.randomUUID()
      await whilePublishing(report.id, () =>
        withRetry(() =>
          callables.verifyReport({
            reportId: report.id,
            scrubbedDescription,
            idempotencyKey,
          }),
        ),
      )
      setActionError(null)
      setSuccessMessage('Na-publish sa pampublikong feed.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Publish failed')
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

          <aside className="space-y-5">
            <OfficialAlertsWidget
              alerts={officialAlerts}
              moderatingIds={moderatingContentIds}
              onToggleVisibility={(alertId, visibility) =>
                void handleCitizenContentVisibility('alerts', alertId, visibility)
              }
            />
            <CitizenPostsWidget
              updates={citizenSituationUpdates}
              moderatingIds={moderatingContentIds}
              onToggleVisibility={(updateId, visibility) =>
                void handleCitizenContentVisibility('feed', updateId, visibility)
              }
              onHideAuthor={setConfirmHideAuthor}
            />
            <PublicFeedPreview reports={publicFeedReports} mediaUrlsByReport={mediaUrlsByReport} />
          </aside>
        </div>
      </main>
      <ConfirmationModal
        open={confirmHideAuthor !== null}
        title="Hide all posts by author"
        message={hideAuthorMessage(hideAuthorTargets.length, confirmHideAuthor)}
        confirmLabel="Hide all"
        confirmVariant="danger"
        confirmLoading={hidingAuthorBusy}
        onConfirm={() => handleHideAllByAuthor(hideAuthorTargets)}
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
