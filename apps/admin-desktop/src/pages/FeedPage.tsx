import { useMemo, useState, useEffect } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { collection, getDocs } from 'firebase/firestore'
import { getStorage, ref, getDownloadURL } from 'firebase/storage'
import { CommandHeader } from '../components/CommandHeader'
import { FeedCard } from '../components/FeedCard'
import { OfflineBanner } from '../components/OfflineBanner'
import { ConfirmationModal } from '../components/ConfirmationModal'
import { PageSkeleton } from '../components/PageSkeleton'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { callables } from '../services/callables'
import { db } from '../app/firebase'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'
import { withRetry } from '../utils/withRetry'
import { useOptimisticFeedActions } from '../hooks/useOptimisticFeedActions'
import type { Report } from '../types'

interface MediaItem {
  uploadId: string
  url: string
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

const SEVERITY_COLORS: Record<string, string> = {
  high: 'var(--color-danger)',
  medium: 'var(--color-warning)',
  low: 'var(--color-info)',
}

export default function FeedPage() {
  const { signOut } = useAuth()
  const { loading, error, reports, alerts } = useFirestoreListeners({ windowType: 'dashboard', db })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [mediaUrlsByReport, setMediaUrlsByReport] = useState<Record<string, MediaItem[]>>({})
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [confirmUnpublishReport, setConfirmUnpublishReport] = useState<Report | null>(null)
  const [activeTab, setActiveTab] = useState<'new' | 'pending' | 'live'>('new')

  const { optimisticReports, optimisticVerify, optimisticUnpublish, pendingIds } =
    useOptimisticFeedActions({
      reports,
      verifyReport: async (reportId) => {
        await withRetry(() =>
          callables.verifyReport({
            reportId,
            idempotencyKey: generateIdempotencyKey(),
          }),
        )
      },
      unpublishReport: async (reportId) => {
        await withRetry(() =>
          callables.unpublishReport({
            reportId,
            reason: 'sensitive_content',
            idempotencyKey: generateIdempotencyKey(),
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

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => {
      setSuccessMessage(null)
    }, 4000)
    return () => {
      clearTimeout(timer)
    }
  }, [successMessage])

  const newReports = useMemo(
    () =>
      feedReports.filter(({ report }) => report.status === 'new'),
    [feedReports],
  )

  const pendingReports = useMemo(
    () =>
      feedReports.filter(({ report }) => report.status === 'awaiting_verify'),
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

  const reportIdsKey = feedReports.map(({ report }) => report.id).join(',')
  useEffect(() => {
    let cancelled = false
    async function fetchMedia() {
      const urls: Record<string, MediaItem[]> = {}
      for (const { report } of feedReports) {
        try {
          const mediaSnap = await getDocs(collection(db, 'reports', report.id, 'media'))
          const results = await Promise.allSettled(
            mediaSnap.docs.map(async (d) => {
              const data = d.data()
              if (typeof data.storagePath !== 'string') return null
              try {
                const url = await getDownloadURL(ref(getStorage(), data.storagePath))
                return { uploadId: d.id, url }
              } catch {
                return null
              }
            }),
          )
          urls[report.id] = results
            .filter(
              (r): r is PromiseFulfilledResult<MediaItem | null> => r.status === 'fulfilled',
            )
            .map((r) => r.value)
            .filter((v): v is MediaItem => v !== null)
        } catch {
          if (!cancelled)
            setMediaError('Some photos failed to load. They will retry automatically.')
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
      setActionError('Kopyang nilinis ay hindi maaaring walang laman.')
      return
    }
    setPublishingIds((prev) => new Set(prev).add(report.id))
    try {
      await withRetry(() =>
        callables.verifyReport({
          reportId: report.id,
          scrubbedDescription,
          idempotencyKey: generateIdempotencyKey(),
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
                {publicFeedReports.length} live · {officialAlerts.length} alert
                {officialAlerts.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Tabs */}
            <nav
              aria-label="Moderation queue tabs"
              className="flex border-b border-white/10"
            >
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
                      color: active
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-muted)',
                      borderBottom: active ? '2px solid var(--color-success)' : '2px solid transparent',
                    }}
                    aria-current={active ? 'page' : undefined}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>

            {successMessage && (
              <div
                className="rounded-lg border border-[var(--color-success)] bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]"
                role="status"
              >
                {successMessage}
              </div>
            )}

            {actionError && (
              <div
                className="rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]"
                role="alert"
              >
                {actionError}
                <button
                  onClick={() => {
                    setActionError(null)
                  }}
                  className="ml-3 underline"
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
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
                  {officialAlerts.map((alert, index) => (
                    <article
                      key={readString(alert, 'id') || `alert-${String(index)}`}
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
                    </article>
                  ))}
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
                                SEVERITY_COLORS[report.severity] || 'var(--color-text-muted)',
                            }}
                            aria-hidden="true"
                          >
                            {(report.type || '?').slice(0, 1).toUpperCase()}
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
