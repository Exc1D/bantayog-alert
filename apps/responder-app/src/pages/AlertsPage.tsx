import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bell,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Radio,
  WifiOff,
} from 'lucide-react'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { useOfficialAlerts, type OfficialAlertItem } from '../hooks/useOfficialAlerts'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import styles from './AlertsPage.module.css'

const MUNICIPALITY_LABELS = new Map(
  CAMARINES_NORTE_MUNICIPALITIES.map((municipality) => [municipality.id, municipality.label]),
)

const FIREBASE_ERROR_MAP: Record<string, string> = {
  permission_denied: 'Access denied. You do not have permission to view official alerts.',
  unavailable: 'The alert service is temporarily unavailable. Please try again.',
  'deadline-exceeded': 'The request timed out. Check your internet connection and try again.',
  'not-found': 'The alerts data could not be found.',
  'resource-exhausted': 'Too many requests. Please wait and try again.',
  cancelled: 'The request was cancelled.',
}

function mapFirebaseError(message: string): string {
  for (const [code, friendly] of Object.entries(FIREBASE_ERROR_MAP)) {
    if (message.toLowerCase().includes(code)) return friendly
  }
  return message
}

function timeAgo(timestamp: number): string {
  if (timestamp <= 0) return 'time pending'
  const minutes = Math.floor((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  const days = Math.floor(hours / 24)
  if (days > 30) return 'over 30 days ago'
  return `${String(days)}d ago`
}

function formatAbsoluteTime(timestamp: number): string {
  if (timestamp <= 0) return ''
  return new Date(timestamp).toLocaleString()
}

function formatHazard(value: string): string {
  return value.replace(/_/g, ' ')
}

function hazardClassSuffix(raw: string): string {
  const normalized = raw.replace(/_/g, '').toLowerCase()
  if (['flood', 'stormsurge', 'fire', 'earthquake', 'typhoon', 'landslide'].includes(normalized)) {
    return normalized
  }
  return 'default'
}

function formatScope(municipalityIds: string[]): string {
  if (municipalityIds.length === 0) return 'Province-wide'
  return municipalityIds.map((id) => MUNICIPALITY_LABELS.get(id) ?? id).join(', ')
}

function AlertCard({ alert }: { alert: OfficialAlertItem }) {
  const [expanded, setExpanded] = useState(false)
  const hazard = formatHazard(alert.hazardType)
  const body = alert.message || 'Official alert details unavailable.'
  const bodyClamped = body.length > 180 && !expanded
  const declaredByLabel = alert.declaredBy || 'Bantayog Operations Center'
  const hazardClass = hazardClassSuffix(alert.hazardType)

  return (
    <article className={styles.card} aria-label={`${hazard} alert`}>
      <header className={styles.cardHeader}>
        <span
          className={[
            styles.iconBadge,
            styles[
              `iconBadge${hazardClass.charAt(0).toUpperCase() + hazardClass.slice(1)}` as keyof typeof styles
            ],
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          <Radio size={18} />
        </span>
        <div className={styles.headerText}>
          <h2 className={styles.cardTitle}>{hazard}</h2>
          <p className={styles.metaLine}>
            <Clock size={13} aria-hidden="true" />
            <span title={formatAbsoluteTime(alert.publishedAtMillis)}>
              {timeAgo(alert.publishedAtMillis)}
            </span>
            <span aria-hidden="true">.</span>
            <MapPin size={13} aria-hidden="true" />
            <span>{formatScope(alert.affectedMunicipalityIds)}</span>
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
          aria-label="Show full alert message"
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
          aria-label="Collapse alert message"
        >
          Show less <ChevronUp size={14} aria-hidden="true" />
        </button>
      )}

      <footer className={styles.statusRow}>
        <span
          className={[
            styles.hazardChip,
            styles[
              `hazard${hazardClass.charAt(0).toUpperCase() + hazardClass.slice(1)}` as keyof typeof styles
            ],
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {hazard}
        </span>
        <span>Declared by {declaredByLabel}</span>
      </footer>
    </article>
  )
}

export function AlertsPage() {
  const { alerts, loading, error, retry, lastUpdatedAt } = useOfficialAlerts()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      clearInterval(id)
    }
  }, [])

  const online = useOnlineStatus()
  const hasAlerts = alerts.length > 0
  const displayError = error !== null ? mapFirebaseError(error) : null

  const [selectedHazard, setSelectedHazard] = useState<string | null>(null)

  const hazardTypes = useMemo(() => {
    const types = new Set(alerts.map((a) => a.hazardType))
    return Array.from(types).sort()
  }, [alerts])

  const filteredAlerts = useMemo(() => {
    if (selectedHazard === null) return alerts
    return alerts.filter((a) => a.hazardType === selectedHazard)
  }, [alerts, selectedHazard])

  return (
    <section className={styles.page} aria-labelledby="alerts-title">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="alerts-title" className={styles.pageTitle}>
            Alerts
          </h1>
          <p className={styles.pageMeta}>
            {selectedHazard
              ? `${String(filteredAlerts.length)} of ${String(alerts.length)} official alerts`
              : `${String(alerts.length)} official alerts`}
          </p>
        </div>
      </header>

      {displayError !== null && hasAlerts && (
        <div role="alert" className={styles.card}>
          <strong className={styles.cardTitle}>Could not refresh official alerts</strong>
          <span className={styles.body}>{displayError}</span>{' '}
          <button type="button" className={styles.btnRetry} onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div role="status" className={styles.state}>
          <Bell size={32} aria-hidden="true" />
          <span>Loading official alerts</span>
        </div>
      ) : displayError !== null && !hasAlerts ? (
        <div role="alert" className={styles.state}>
          <AlertCircle size={32} aria-hidden="true" />
          <strong>Could not load official alerts</strong>
          <span>{displayError}</span>
          <button type="button" className={styles.btnRetry} onClick={retry}>
            Retry
          </button>
        </div>
      ) : !hasAlerts ? (
        <div className={styles.state}>
          <Bell size={32} aria-hidden="true" />
          <strong>No official alerts</strong>
          {online ? (
            <span>New declarations will appear here.</span>
          ) : (
            <span>Connect to the internet to receive alerts.</span>
          )}
        </div>
      ) : (
        <>
          {!online && (
            <div role="status" className={styles.offlineBanner}>
              <WifiOff size={16} aria-hidden="true" />
              <span>You&rsquo;re offline. Showing cached alerts.</span>
            </div>
          )}

          {hazardTypes.length > 1 && (
            <div className={styles.filterBar} role="group" aria-label="Filter by hazard type">
              <button
                type="button"
                className={[styles.filterChip, selectedHazard === null && styles.filterChipActive]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setSelectedHazard(null)
                }}
                aria-pressed={selectedHazard === null}
              >
                All
              </button>
              {hazardTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={[styles.filterChip, selectedHazard === type && styles.filterChipActive]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setSelectedHazard(type)
                  }}
                  aria-pressed={selectedHazard === type}
                >
                  {formatHazard(type)}
                </button>
              ))}
            </div>
          )}

          {filteredAlerts.length > 0 ? (
            <>
              <div className={styles.freshnessBar} aria-live="polite" aria-atomic="true">
                {lastUpdatedAt === 0 ? (
                  <span className={styles.freshnessText}>Connecting…</span>
                ) : (
                  <>
                    <span
                      className={[
                        styles.freshnessDot,
                        now - lastUpdatedAt < 60_000 ? styles.fresh : styles.stale,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-hidden="true"
                    />
                    <span className={styles.freshnessText}>
                      {now - lastUpdatedAt < 60_000
                        ? 'Live'
                        : `Updated ${String(Math.floor((now - lastUpdatedAt) / 1000))}s ago`}
                    </span>
                  </>
                )}
              </div>
              <div className={styles.alertList}>
                {filteredAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </>
          ) : (
            <div className={styles.state}>
              <Bell size={32} aria-hidden="true" />
              <strong>No alerts match this filter</strong>
              <span>Try selecting a different hazard type.</span>
            </div>
          )}
        </>
      )}
    </section>
  )
}
