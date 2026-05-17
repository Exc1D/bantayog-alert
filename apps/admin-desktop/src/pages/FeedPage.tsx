import { useMemo, useState } from 'react'
import { useAuth } from '@bantayog/shared-ui'
import { CommandHeader } from '../components/CommandHeader'
import { OfflineBanner } from '../components/OfflineBanner'
import { useFirestoreListeners } from '../hooks/useFirestoreListeners'
import { callables } from '../services/callables'
import { db } from '../app/firebase'
import { mapReportDocToReportLoose } from '../utils/map-report-doc'
import type { Report } from '../types'

function generateIdempotencyKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `${String(Date.now())}-${Math.random().toString(36).slice(2)}`
  }
}

function visibilityLabel(doc: Record<string, unknown>, report: Report): string {
  if (doc.visibilityClass === 'public_alertable') return 'Published'
  if (report.status === 'awaiting_verify') return 'Pending publication'
  if (report.status === 'verified') return 'Unpublished'
  return 'Intake'
}

export default function FeedPage() {
  const { signOut } = useAuth()
  const { loading, error, reports } = useFirestoreListeners({ windowType: 'dashboard', db })
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [lastUpdatedAt] = useState(() => Date.now())

  const feedReports = useMemo(
    () =>
      reports
        .map((doc) => {
          const raw = doc as unknown as Record<string, unknown>
          return { raw, report: mapReportDocToReportLoose(raw) }
        })
        .filter(
          ({ raw, report }) =>
            raw.visibilityClass === 'public_alertable' || report.status !== 'new',
        ),
    [reports],
  )

  async function publishScrubbed(report: Report) {
    const scrubbedDescription = (drafts[report.id] ?? report.description).trim()
    if (!scrubbedDescription) {
      setActionError('Scrubbed copy cannot be empty.')
      return
    }
    setPublishingId(report.id)
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
      setPublishingId(null)
    }
  }

  async function unpublish(report: Report) {
    setUnpublishingId(report.id)
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
      setUnpublishingId(null)
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
          void signOut()
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
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[var(--color-surface-elevated)]">
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
                      {canPublish && (
                        <button
                          type="button"
                          onClick={() => {
                            void publishScrubbed(report)
                          }}
                          disabled={publishingId === report.id}
                          className="rounded bg-[var(--color-success)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Publish scrubbed copy for ${report.id}`}
                        >
                          {publishingId === report.id ? 'Publishing' : 'Publish scrubbed copy'}
                        </button>
                      )}
                      {canUnpublish && (
                        <button
                          type="button"
                          onClick={() => {
                            void unpublish(report)
                          }}
                          disabled={unpublishingId === report.id}
                          className="rounded border border-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Unpublish report ${report.id}`}
                        >
                          {unpublishingId === report.id ? 'Unpublishing' : 'Unpublish'}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
