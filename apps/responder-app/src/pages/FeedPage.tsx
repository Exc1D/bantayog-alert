import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Building,
  Car,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudLightning,
  Droplets,
  FileText,
  Flame,
  HeartPulse,
  Image as ImageIcon,
  MapPin,
  Mountain,
  ShieldAlert,
  Waves,
  Wind,
} from 'lucide-react'
import { usePublicFeed, type PublicFeedItem } from '../hooks/usePublicFeed'
import { getReportTypeLabel } from '../lib/incident-labels'
import { timeAgo } from '../lib/time-ago'
import styles from './FeedPage.module.css'

function formatStatus(value: string): string {
  return value.replace(/_/g, ' ')
}

const REPORT_TYPE_ICONS: Record<string, LucideIcon> = {
  flood: Waves,
  fire: Flame,
  earthquake: CloudLightning,
  typhoon: Wind,
  landslide: Mountain,
  storm_surge: Droplets,
  medical: HeartPulse,
  accident: Car,
  structural: Building,
  security: ShieldAlert,
  other: AlertTriangle,
}

function renderReportTypeIcon(reportType: string | undefined): React.ReactElement {
  if (reportType == null) {
    return <AlertTriangle size={18} />
  }
  const Icon = REPORT_TYPE_ICONS[reportType] ?? AlertTriangle
  return <Icon size={18} />
}

function severityClass(severity: string): string {
  if (severity === 'high') return styles.severityHigh ?? ''
  if (severity === 'medium') return styles.severityMedium ?? ''
  return styles.severityLow ?? ''
}

function locationLabel(item: PublicFeedItem): string {
  const parts = [item.barangayId, item.municipalityLabel].filter((part) => part.trim().length > 0)
  return parts.length > 0 ? parts.join(', ') : 'Location pending'
}

const COMPACT_THRESHOLD = 10

function FeedCard({ item, compact }: { item: PublicFeedItem; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [brokenMedia, setBrokenMedia] = useState<Set<string>>(() => new Set())
  const reportLabel = getReportTypeLabel(item.reportType)
  const body = item.description.trim() || 'Verified report details unavailable.'
  const bodyClamped = body.length > 180 && !expanded
  const media = item.featuredMediaUrls?.slice(0, 4) ?? []

  if (compact) {
    return (
      <article
        className={styles.compactRow}
        aria-label={`${reportLabel} — ${item.severity} — ${locationLabel(item)}`}
      >
        <span
          className={[styles.compactAvatar, severityClass(item.severity)].join(' ')}
          aria-hidden="true"
        >
          {renderReportTypeIcon(item.reportType)}
        </span>
        <div className={styles.compactMeta}>
          <div className={styles.compactTop}>
            <h2 className={styles.compactTitle}>{reportLabel}</h2>
            <span className={[styles.compactSeverity, severityClass(item.severity)].join(' ')}>
              {item.severity}
            </span>
          </div>
          <p className={styles.compactLine}>
            <MapPin size={12} aria-hidden="true" />
            <span>{locationLabel(item)}</span>
            <span aria-hidden="true">·</span>
            <Clock size={12} aria-hidden="true" />
            <span>{timeAgo(item.submittedAtMillis)}</span>
          </p>
        </div>
      </article>
    )
  }

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
          {renderReportTypeIcon(item.reportType)}
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

      <p className={bodyClamped ? [styles.body, styles.bodyClamped].join(' ') : styles.body}>
        {body}
      </p>
      {bodyClamped && (
        <button
          type="button"
          className={styles.btnExpand}
          onClick={() => {
            setExpanded(true)
          }}
          aria-label="Show full report description"
        >
          Show more <ChevronDown size={14} aria-hidden="true" />
        </button>
      )}
      {expanded && body.length > 180 && (
        <button
          type="button"
          className={styles.btnExpand}
          onClick={() => {
            setExpanded(false)
          }}
          aria-label="Collapse report description"
        >
          Show less <ChevronUp size={14} aria-hidden="true" />
        </button>
      )}

      {media.length > 0 && (
        <div className={styles.mediaGrid} aria-label="Incident media">
          {media.map((url, index) => {
            const isBroken = brokenMedia.has(url)
            return isBroken ? (
              <div key={`${item.id}-${url}`} className={styles.mediaBroken} aria-hidden="true" />
            ) : (
              <img
                key={`${item.id}-${url}`}
                src={url}
                alt={`Incident media ${String(index + 1)} for report ${item.id}`}
                loading="lazy"
                className={styles.media}
                onError={() => {
                  setBrokenMedia((prev) => {
                    const next = new Set(prev)
                    next.add(url)
                    return next
                  })
                }}
              />
            )
          })}
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

function freshnessLabel(lastUpdatedAt: number | null): string {
  if (lastUpdatedAt === null) return ''
  const seconds = Math.round((Date.now() - lastUpdatedAt) / 1000)
  if (seconds < 60) return 'Live'
  if (seconds < 3600) return `Updated ${String(Math.round(seconds / 60))}m ago`
  return `Updated ${String(Math.round(seconds / 3600))}h ago`
}

export function FeedPage() {
  const { items, loading, error, retry, lastUpdatedAt } = usePublicFeed()
  const [activeSeverities, setActiveSeverities] = useState<Set<string>>(new Set())
  const filteredItems =
    activeSeverities.size > 0 ? items.filter((item) => activeSeverities.has(item.severity)) : items
  const hasItems = filteredItems.length > 0
  const compact = filteredItems.length > COMPACT_THRESHOLD
  const severityOptions = ['high', 'medium', 'low'] as const
  const freshness = freshnessLabel(lastUpdatedAt)
  const isLive = freshness === 'Live'

  return (
    <section className={styles.page} aria-labelledby="feed-title">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="feed-title" className={styles.pageTitle}>
            Incident Feed
          </h1>
          <p className={styles.pageMeta}>{String(filteredItems.length)} visible reports</p>
        </div>
        {lastUpdatedAt !== null && (
          <p className={isLive ? styles.freshLive : styles.freshStale} aria-live="polite">
            {isLive && <span className={styles.liveDot} aria-hidden="true" />}
            {freshness}
          </p>
        )}
      </header>

      <div className={styles.filterBar} role="group" aria-label="Filter by severity">
        {severityOptions.map((sev) => {
          const active = activeSeverities.has(sev)
          return (
            <button
              key={sev}
              type="button"
              className={[styles.filterChip, active && styles.filterChipActive]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={active}
              onClick={() => {
                setActiveSeverities((prev) => {
                  const next = new Set(prev)
                  if (next.has(sev)) {
                    next.delete(sev)
                  } else {
                    next.add(sev)
                  }
                  return next
                })
              }}
            >
              {sev}
            </button>
          )
        })}
      </div>

      {error !== null && hasItems && (
        <div role="alert" className={styles.card}>
          <strong className={styles.cardTitle}>Could not refresh feed</strong>
          <span className={styles.body}>{error}</span>{' '}
          <button type="button" className={styles.btnRetry} onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div role="status" className={styles.state}>
          <FileText size={32} aria-hidden="true" />
          <span>Loading incident feed</span>
        </div>
      ) : error !== null && !hasItems ? (
        <div role="alert" className={styles.state}>
          <AlertCircle size={32} aria-hidden="true" />
          <strong>Could not load incident feed</strong>
          <span>{error}</span>
          <button type="button" className={styles.btnRetry} onClick={retry}>
            Retry
          </button>
        </div>
      ) : !hasItems && items.length > 0 ? (
        <div className={styles.state}>
          <strong>All reports filtered</strong>
          <span>No reports match the selected filters.</span>
          <button
            type="button"
            className={styles.btnRetry}
            onClick={() => {
              setActiveSeverities(new Set())
            }}
          >
            Clear filters
          </button>
        </div>
      ) : !hasItems ? (
        <div className={styles.state}>
          <ImageIcon size={32} aria-hidden="true" />
          <strong>No reports yet</strong>
          <span>Verified incident reports will appear here.</span>
        </div>
      ) : (
        <div className={styles.feedList}>
          {filteredItems.map((item) => (
            <FeedCard key={item.id} item={item} compact={compact} />
          ))}
        </div>
      )}
    </section>
  )
}
