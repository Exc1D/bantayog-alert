import { AlertCircle, Clock, FileText, Image as ImageIcon, MapPin } from 'lucide-react'
import { usePublicFeed, type PublicFeedItem } from '../hooks/usePublicFeed'
import { getReportTypeLabel } from '../lib/incident-labels'
import styles from './FeedPage.module.css'

function timeAgo(timestamp: number): string {
  if (timestamp <= 0) return 'time pending'
  const minutes = Math.floor((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function formatStatus(value: string): string {
  return value.replace(/_/g, ' ')
}

function severityClass(severity: string): string | undefined {
  if (severity === 'high') return styles.severityHigh
  if (severity === 'medium') return styles.severityMedium
  return styles.severityLow
}

function locationLabel(item: PublicFeedItem): string {
  const parts = [item.barangayId, item.municipalityLabel].filter((part) => part.trim().length > 0)
  return parts.length > 0 ? parts.join(', ') : 'Location pending'
}

function FeedCard({ item }: { item: PublicFeedItem }) {
  const reportLabel = getReportTypeLabel(item.reportType)
  const body = item.description.trim() || 'Verified report details unavailable.'
  const media = item.featuredMediaUrls?.slice(0, 4) ?? []

  return (
    <article
      className={styles.card}
      aria-label={`${reportLabel} report in ${item.municipalityLabel}`}
    >
      <header className={styles.cardHeader}>
        <span
          className={[styles.avatar, severityClass(item.severity)].join(' ')}
          aria-hidden="true"
        >
          <FileText size={18} />
        </span>
        <div className={styles.headerText}>
          <h2 className={styles.cardTitle}>{reportLabel}</h2>
          <p className={styles.metaLine}>
            <Clock size={13} aria-hidden="true" />
            <span>{timeAgo(item.submittedAtMillis)}</span>
            <span aria-hidden="true">.</span>
            <MapPin size={13} aria-hidden="true" />
            <span>{locationLabel(item)}</span>
          </p>
        </div>
      </header>

      <p className={styles.body}>{body}</p>

      {media.length > 0 && (
        <div className={styles.mediaGrid} aria-label="Incident media">
          {media.map((url, index) => (
            <img
              key={`${item.id}-${url}`}
              src={url}
              alt={`Incident media ${String(index + 1)} for report ${item.id}`}
              loading="lazy"
              className={styles.media}
            />
          ))}
        </div>
      )}

      <footer className={styles.statusRow}>
        <span className={[styles.statusChip, severityClass(item.severity)].join(' ')}>
          {item.severity}
        </span>
        <span>{formatStatus(item.status)}</span>
        {item.verifiedAtMillis !== undefined && (
          <span>Verified {timeAgo(item.verifiedAtMillis)}</span>
        )}
      </footer>
    </article>
  )
}

export function FeedPage() {
  const { items, loading, error } = usePublicFeed()
  const hasItems = items.length > 0

  return (
    <section className={styles.page} aria-labelledby="feed-title">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="feed-title" className={styles.pageTitle}>
            Public Feed
          </h1>
          <p className={styles.pageMeta}>{String(items.length)} visible reports</p>
        </div>
      </header>

      {error !== null && hasItems && (
        <div role="alert" className={styles.card}>
          <strong className={styles.cardTitle}>Could not refresh public feed</strong>
          <span className={styles.body}>{error}</span>
        </div>
      )}

      {loading ? (
        <div role="status" className={styles.state}>
          <FileText size={32} aria-hidden="true" />
          <span>Loading public feed</span>
        </div>
      ) : error !== null && !hasItems ? (
        <div role="alert" className={styles.state}>
          <AlertCircle size={32} aria-hidden="true" />
          <strong>Could not load public feed</strong>
          <span>{error}</span>
        </div>
      ) : !hasItems ? (
        <div className={styles.state}>
          <ImageIcon size={32} aria-hidden="true" />
          <strong>No public reports yet</strong>
          <span>Verified public reports will appear here.</span>
        </div>
      ) : (
        <div className={styles.feedList}>
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
