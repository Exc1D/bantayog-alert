import { AlertCircle, Bell, Clock, MapPin, Radio } from 'lucide-react'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { useOfficialAlerts, type OfficialAlertItem } from '../hooks/useOfficialAlerts'
import styles from './AlertsPage.module.css'

const MUNICIPALITY_LABELS = new Map(
  CAMARINES_NORTE_MUNICIPALITIES.map((municipality) => [municipality.id, municipality.label]),
)

function timeAgo(timestamp: number): string {
  if (timestamp <= 0) return 'time pending'
  const minutes = Math.floor((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)}h ago`
  return `${String(Math.floor(hours / 24))}d ago`
}

function formatHazard(value: string): string {
  return value.replace(/_/g, ' ')
}

function formatScope(municipalityIds: string[]): string {
  if (municipalityIds.length === 0) return 'Province-wide'
  return municipalityIds.map((id) => MUNICIPALITY_LABELS.get(id) ?? id).join(', ')
}

function AlertCard({ alert }: { alert: OfficialAlertItem }) {
  const hazard = formatHazard(alert.hazardType)

  return (
    <article className={styles.card} aria-label={`${hazard} alert`}>
      <header className={styles.cardHeader}>
        <span className={styles.iconBadge} aria-hidden="true">
          <Radio size={18} />
        </span>
        <div className={styles.headerText}>
          <h2 className={styles.cardTitle}>{hazard}</h2>
          <p className={styles.metaLine}>
            <Clock size={13} aria-hidden="true" />
            <span>{timeAgo(alert.publishedAtMillis)}</span>
            <span aria-hidden="true">.</span>
            <MapPin size={13} aria-hidden="true" />
            <span>{formatScope(alert.affectedMunicipalityIds)}</span>
          </p>
        </div>
      </header>

      <p className={styles.body}>{alert.message}</p>

      <footer className={styles.statusRow}>
        <span className={styles.hazardChip}>{hazard}</span>
        <span>Declared by {alert.declaredBy || 'unknown'}</span>
      </footer>
    </article>
  )
}

export function AlertsPage() {
  const { alerts, loading, error } = useOfficialAlerts()
  const hasAlerts = alerts.length > 0

  return (
    <section className={styles.page} aria-labelledby="alerts-title">
      <header className={styles.pageHeader}>
        <div>
          <h1 id="alerts-title" className={styles.pageTitle}>
            Alerts
          </h1>
          <p className={styles.pageMeta}>{String(alerts.length)} official alerts</p>
        </div>
      </header>

      {error !== null && hasAlerts && (
        <div role="alert" className={styles.card}>
          <strong className={styles.cardTitle}>Could not refresh official alerts</strong>
          <span className={styles.body}>{error}</span>
        </div>
      )}

      {loading ? (
        <div role="status" className={styles.state}>
          <Bell size={32} aria-hidden="true" />
          <span>Loading official alerts</span>
        </div>
      ) : error !== null && !hasAlerts ? (
        <div role="alert" className={styles.state}>
          <AlertCircle size={32} aria-hidden="true" />
          <strong>Could not load official alerts</strong>
          <span>{error}</span>
        </div>
      ) : !hasAlerts ? (
        <div className={styles.state}>
          <Bell size={32} aria-hidden="true" />
          <strong>No official alerts</strong>
          <span>New declarations will appear here.</span>
        </div>
      ) : (
        <div className={styles.alertList}>
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </section>
  )
}
